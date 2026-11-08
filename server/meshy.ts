import type { Express } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Store } from "./store";
import {
  requireCondition as check,
  idSchema,
  integerEnv,
  parseImage,
} from "./policy";

export function mountMeshy(
  app: Express,
  env: NodeJS.ProcessEnv,
  store: () => Store,
  request: typeof fetch = fetch,
) {
  const cap = integerEnv(env, "MESHY_MAX_TASK_CREDITS");
  const budget = integerEnv(env, "MESHY_DAILY_CREDIT_BUDGET");
  const users = new Set(
    (env.MESHY_ALLOWED_UIDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const ready = !!(
    env.MESHY_API_KEY &&
    env.MESHY_MODEL &&
    cap > 0 &&
    budget >= cap &&
    users.size
  );
  const allowed = (req: any) => {
    check(
      ready,
      503,
      "Meshy generation needs a server API key, pinned model, credit limits and allowed accounts.",
    );
    check(
      users.has(req.user.uid),
      403,
      "Meshy generation is limited to approved accounts during setup.",
    );
  };
  const route = (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res)).catch(next);
  const endpoint = (kind: string) =>
    kind === "image"
      ? "/openapi/v1/image-to-3d"
      : kind === "retexture"
        ? "/openapi/v1/retexture"
        : "/openapi/v2/text-to-3d";
  const call = async (path: string, body?: any) => {
    const response = await request(`https://api.meshy.ai${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${env.MESHY_API_KEY}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    check(
      response.ok,
      502,
      "Meshy could not complete this request. Check the provider dashboard before retrying a submission.",
    );
    return response.json();
  };
  const own = async (req: any) => {
    const job = await store().get(`meshyJobs/${idSchema.parse(req.params.id)}`);
    check(job && job.uid === req.user.uid, 404, "Model task was not found.");
    return job;
  };
  app.get(
    "/api/modeling/config",
    route(async (req: any, res: any) =>
      res.json({
        ready: ready && users.has(req.user.uid),
        retextureReady:
          ready && users.has(req.user.uid) && !!env.MESHY_TEXTURE_MODEL,
        maxTaskCredits: cap,
        dailyCredits: budget,
        model: env.MESHY_MODEL || null,
      }),
    ),
  );
  app.get(
    "/api/modeling/tasks",
    route(async (req: any, res: any) =>
      res.json(
        (await store().where("meshyJobs", "uid", req.user.uid))
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 20)
          .map((j) => ({
            id: j.id,
            kind: j.kind,
            status: j.status,
            createdAt: j.createdAt,
          })),
      ),
    ),
  );
  app.post(
    "/api/modeling/tasks",
    route(async (req: any, res: any) => {
      allowed(req);
      const body = z
        .object({
          requestId: z.string().uuid(),
          kind: z.enum(["image", "text", "retexture"]),
          sourceId: idSchema.optional(),
          prompt: z.string().trim().min(3).max(800).optional(),
          image: z.string().max(4300000).optional(),
          consent: z.literal(true),
        })
        .parse(req.body);
      check(
        body.kind === "image"
          ? !!body.image
          : body.kind === "retexture"
            ? !!(body.image || body.prompt)
            : !!body.prompt,
        400,
        "Add a reference image or description.",
      );
      if (body.image) parseImage(body.image, 3 * 1024 * 1024);
      let sourceTask: string | undefined;
      if (body.kind === "retexture") {
        check(
          env.MESHY_TEXTURE_MODEL,
          503,
          "Configure a reviewed Meshy texture model before applying a design.",
        );
        check(body.sourceId, 400, "Select a completed model first.");
        const source = await store().get(`meshyJobs/${body.sourceId}`);
        check(
          source && source.uid === req.user.uid && source.taskId,
          404,
          "Source model was not found.",
        );
        const result = await call(
          `${endpoint(source.kind)}/${idSchema.parse(source.taskId)}`,
        );
        check(
          result.status === "SUCCEEDED",
          409,
          "Wait for the source model to finish.",
        );
        sourceTask = source.taskId;
      }
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            kind: body.kind,
            prompt: body.prompt || "",
            image: body.image || "",
            sourceId: body.sourceId || "",
          }),
        )
        .digest("hex");
      const id = createHash("sha256")
        .update(`${req.user.uid}:${body.requestId}`)
        .digest("hex");
      const day = new Date().toISOString().slice(0, 10);
      const createdAt = Date.now();
      const job = {
        id,
        uid: req.user.uid,
        kind: body.kind,
        status: "SUBMITTING",
        createdAt,
        reservedCredits: cap,
        fingerprint,
        ...(body.sourceId ? { sourceId: body.sourceId } : {}),
      };
      const reserved = await store().transaction(async (tx) => {
        const previous = await tx.get(`meshyJobs/${id}`);
        if (previous) {
          check(
            previous.fingerprint === fingerprint,
            409,
            "This submission ID belongs to different inputs. Check the existing task before creating another.",
          );
          return false;
        }
        const spent = await tx.get(`meshyBudgets/${day}`);
        const user = await tx.get(`meshyUserLimits/${req.user.uid}_${day}`);
        check(
          (spent?.credits || 0) + cap <= budget,
          429,
          "Daily Meshy credit limit reached.",
        );
        check(
          (user?.jobs || 0) < 3,
          429,
          "Daily account generation limit reached.",
        );
        tx.set(`meshyBudgets/${day}`, { credits: (spent?.credits || 0) + cap });
        tx.set(`meshyUserLimits/${req.user.uid}_${day}`, {
          jobs: (user?.jobs || 0) + 1,
        });
        tx.set(`meshyJobs/${id}`, job);
        return true;
      });
      if (!reserved) return res.json({ id });
      try {
        const result = await call(
          endpoint(body.kind),
          body.kind === "retexture"
            ? {
                input_task_id: sourceTask,
                ai_model: env.MESHY_TEXTURE_MODEL,
                enable_original_uv: true,
                enable_pbr: true,
                ...(body.image
                  ? { image_style_url: body.image }
                  : { text_style_prompt: body.prompt }),
              }
            : {
                ai_model: env.MESHY_MODEL,
                target_formats: ["glb"],
                should_remesh: true,
                target_polycount: 30000,
                ...(body.kind === "image"
                  ? {
                      image_url: body.image,
                      should_texture: true,
                      enable_pbr: true,
                    }
                  : { mode: "preview", prompt: body.prompt }),
              },
        );
        const taskId = idSchema.parse(result.result);
        await store().transaction(async (tx) => {
          tx.set(`meshyJobs/${id}`, { ...job, taskId, status: "PENDING" });
        });
      } catch {
        // A timeout can occur after Meshy accepted the job. Never retry automatically or release its reservation.
        await store().transaction(async (tx) => {
          tx.set(`meshyJobs/${id}`, { ...job, status: "SUBMISSION_UNKNOWN" });
        });
      }
      res.json({ id });
    }),
  );
  app.get(
    "/api/modeling/tasks/:id",
    route(async (req: any, res: any) => {
      const job = await own(req);
      if (!job.taskId)
        return res.json({
          id: job.id,
          kind: job.kind,
          status: job.status,
          progress: 0,
        });
      const result = await call(
        `${endpoint(job.kind)}/${idSchema.parse(job.taskId)}`,
      );
      await store().transaction(async (tx) => {
        tx.set(`meshyJobs/${job.id}`, { ...job, status: result.status });
      });
      res.json({
        id: job.id,
        kind: job.kind,
        status: result.status,
        progress: Number.isFinite(result.progress)
          ? Math.max(0, Math.min(100, result.progress))
          : 0,
        hasModel: result.status === "SUCCEEDED" && !!result.model_urls?.glb,
      });
    }),
  );
  app.get(
    "/api/modeling/tasks/:id/model",
    route(async (req: any, res: any) => {
      const job = await own(req);
      check(job.taskId, 409, "Model is not ready.");
      const result = await call(
        `${endpoint(job.kind)}/${idSchema.parse(job.taskId)}`,
      );
      check(
        result.status === "SUCCEEDED" && result.model_urls?.glb,
        409,
        "Model is not ready.",
      );
      const url = new URL(result.model_urls.glb);
      check(
        url.protocol === "https:" &&
          url.hostname === "assets.meshy.ai" &&
          !url.port &&
          !url.username &&
          !url.password,
        502,
        "Untrusted model download address.",
      );
      const response = await request(url, {
        redirect: "error",
        signal: AbortSignal.timeout(60000),
      });
      check(
        response.ok && response.body,
        502,
        "Model download failed or expired.",
      );
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          check(
            size <= 30 * 1024 * 1024,
            413,
            "Model exceeds the 30 MB viewer limit.",
          );
          chunks.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel();
      }
      res.type("model/gltf-binary").send(Buffer.concat(chunks));
    }),
  );
}
