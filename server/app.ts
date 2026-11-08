import express from "express";
import { mountMeshy } from "./meshy";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import { GoogleGenAI } from "@google/genai";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { MEN_PRODUCTS, WOMEN_PRODUCTS } from "../src/constants";
import { designSchema } from "../shared/studio";
import { projectSchema } from "../shared/workspace";
import {
  ApiError,
  requireCondition as check,
  pricing,
  eligible,
  idSchema,
  parseImage,
  paidSessionMatches,
} from "./policy";
import { firestoreStore, verifyToken, Store } from "./store";

export interface Dependencies {
  meshyFetch?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  store?: Store;
  verify?: (token: string) => Promise<{ uid: string; admin?: boolean }>;
  payments?: {
    checkout(order: any, url: string): Promise<{ id: string; url: string }>;
    event(body: Buffer, signature: string): any;
    session?(id: string): Promise<any>;
    refund(order: any): Promise<void>;
  };
  generate?: (parts: any[]) => Promise<string>;
}
export function createApp(deps: Dependencies = {}) {
  const env = deps.env || process.env;
  const app = express();
  const costs = pricing(env);
  const hasStore =
    !!deps.store || !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_STORAGE_BUCKET);
  let persistent: Store | undefined = deps.store;
  const store = () => {
    check(hasStore, 503, "Account services are not configured yet.");
    return (persistent ||= firestoreStore());
  };
  const appUrl = env.APP_URL || "http://localhost:3000";
  const validOrigin = (() => {
    try {
      const u = new URL(appUrl);
      return (
        (u.protocol === "https:" ||
          (env.NODE_ENV !== "production" && u.hostname === "localhost")) &&
        u.origin === appUrl
      );
    } catch {
      return false;
    }
  })();
  const readyPayments =
    !!deps.payments || !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  const readyAI =
    (!!deps.generate || !!env.GEMINI_API_KEY) &&
    !!env.GEMINI_IMAGE_MODEL &&
    costs.safe &&
    costs.dailyBudget >= costs.provider + costs.overhead &&
    costs.perUser > 0;
  const ready = hasStore && readyPayments && validOrigin;
  let stripe: Stripe;
  const getStripe = () => (stripe ||= new Stripe(env.STRIPE_SECRET_KEY!));
  const payments: NonNullable<Dependencies["payments"]> = deps.payments || {
    async checkout(order: any, origin: string) {
      const s = await getStripe().checkout.sessions.create(
        {
          mode: "payment",
          client_reference_id: order.uid,
          metadata: { orderId: order.id, uid: order.uid },
          payment_intent_data: {
            metadata: { orderId: order.id, uid: order.uid },
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "inr",
                unit_amount: order.amount,
                product_data: { name: order.label },
              },
            },
          ],
          success_url: `${origin}/payment?order=${order.id}`,
          cancel_url: `${origin}/payment?order=${order.id}&cancelled=1`,
          expires_at: Math.floor(Date.now() / 1000) + 1800,
        },
        { idempotencyKey: order.id },
      );
      return { id: s.id, url: s.url! };
    },
    async session(id: string) {
      return getStripe().checkout.sessions.retrieve(id);
    },
    event(body: Buffer, signature: string) {
      return getStripe().webhooks.constructEvent(
        body,
        signature,
        env.STRIPE_WEBHOOK_SECRET!,
      );
    },
    async refund(order: any) {
      await getStripe().refunds.create(
        {
          payment_intent: order.paymentIntent,
          reason: "requested_by_customer",
        },
        { idempotencyKey: `refund-${order.id}` },
      );
    },
  };
  const generate =
    deps.generate ||
    (async (parts: any[]) => {
      const ai = new GoogleGenAI({
        apiKey: env.GEMINI_API_KEY!,
        httpOptions: { timeout: 90000, retryOptions: { attempts: 1 } },
      });
      const response = await ai.models.generateContent({
        model: env.GEMINI_IMAGE_MODEL!,
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["TEXT", "IMAGE"], candidateCount: 1 },
      });
      const result = response.candidates?.[0]?.content?.parts?.find((p) =>
        p.inlineData?.mimeType?.startsWith("image/"),
      )?.inlineData;
      check(result?.data, 502, "The image service returned no image.");
      const output = `data:${result.mimeType};base64,${result.data}`;
      parseImage(output, 8 * 1024 * 1024);
      return output;
    });
  const route = (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res)).catch(next);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy:
        env.NODE_ENV === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                  "'self'",
                  "https://apis.google.com",
                  "https://www.gstatic.com",
                ],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "blob:", "https:"],
                connectSrc: [
                  "'self'",
                  "blob:",
                  "https://*.googleapis.com",
                  "https://*.firebaseio.com",
                  "wss://*.firebaseio.com",
                ],
                frameSrc: [
                  "https://*.firebaseapp.com",
                  "https://accounts.google.com",
                ],
                fontSrc: ["'self'", "data:"],
                workerSrc: ["'self'", "blob:"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: null,
              },
            }
          : false,
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  async function fulfillSession(session: any) {
    if (session.payment_status !== "paid") return;
    const orderId = idSchema.parse(session.metadata?.orderId);
    await store().transaction(async (tx) => {
      const order = await tx.get(`orders/${orderId}`);
      check(
        order && paidSessionMatches(session, order),
        400,
        "Payment does not match order.",
      );
      const entitlement = (await tx.get(`entitlements/${order.uid}`)) || {
        credits: [],
      };
      if (order.status !== "pending") return;
      check(
        typeof session.payment_intent === "string",
        400,
        "Payment reference is missing.",
      );
      tx.set(`orders/${orderId}`, {
        ...order,
        status: "paid",
        paymentIntent: session.payment_intent,
        paidAt: Date.now(),
      });
      if (order.kind === "publish")
        tx.set(`entitlements/${order.uid}`, {
          ...entitlement,
          credits: [...entitlement.credits, orderId],
        });
      if (order.kind === "pass")
        tx.set(`entitlements/${order.uid}`, {
          ...entitlement,
          passes: [
            ...(entitlement.passes || []),
            { orderId, expiresAt: Date.now() + 30 * 86400000, remaining: 30 },
          ],
        });
    });
  }
  // Verify signatures against the original bytes, before any JSON parsing.
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    route(async (req: any, res: any) => {
      check(ready, 503, "Payments are not configured.");
      let event: any;
      try {
        event = payments.event(req.body, req.headers["stripe-signature"] || "");
      } catch {
        throw new ApiError(400, "Invalid payment signature.");
      }
      if (
        [
          "checkout.session.completed",
          "checkout.session.async_payment_succeeded",
        ].includes(event.type)
      ) {
        const session = event.data.object;
        if (session.payment_status !== "paid")
          return res.json({ received: true });
        await fulfillSession(session);
      } else if (event.type === "charge.refunded") {
        const charge = event.data.object;
        if (charge.refunded && charge.metadata?.orderId)
          await store().transaction(async (tx) => {
            const order = await tx.get(
              `orders/${idSchema.parse(charge.metadata.orderId)}`,
            );
            check(
              order && order.paymentIntent === charge.payment_intent,
              400,
              "Refund does not match order.",
            );
            tx.set(`orders/${order.id}`, {
              ...order,
              status: "refunded",
              refundedAt: Date.now(),
            });
          });
      }
      res.json({ received: true });
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: "9mb" }));
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== appUrl
    )
      return res.status(403).json({ error: "This origin is not allowed." });
    next();
  });
  app.get("/api/config", (_req, res) =>
    res.json({
      paymentsReady: ready,
      tryOnReady: ready && readyAI,
      publishingReady: ready && costs.publish > 0 && costs.membership > 0,
      communityReady: hasStore,
      currency: "INR",
      tryOnPrice: costs.tryon || null,
      publishPrice: costs.publish || null,
      passPrice: costs.membership || null,
    }),
  );
  const seedApproved = new Set(
    (env.APPROVED_TRYON_PRODUCT_IDS || "").split(","),
  );
  function approvedImageUrl(value: string) {
    if (/^\/api\/designs\/[a-zA-Z0-9_-]+\/image$/.test(value)) return true;
    try {
      const u = new URL(value);
      const hosts = new Set([
        "images.unsplash.com",
        "burst.shopifycdn.com",
        ...(env.APPROVED_IMAGE_HOSTS || "").split(",").filter(Boolean),
      ]);
      return (
        u.protocol === "https:" &&
        !u.port &&
        !u.username &&
        !u.password &&
        hosts.has(u.hostname)
      );
    } catch {
      return false;
    }
  }
  const seeds = [...MEN_PRODUCTS, ...WOMEN_PRODUCTS].map((p) => ({
    ...p,
    tryOnEnabled: seedApproved.has(p.id),
    source: "catalog",
    likes: 0,
  }));
  async function findProduct(id: string) {
    const saved = hasStore ? await store().get(`products/${id}`) : null;
    if (saved) {
      check(saved.published !== false, 404, "Design is unavailable.");
      return { ...saved, id };
    }
    const seed = seeds.find((p) => p.id === id);
    check(seed, 404, "Product was not found.");
    return seed;
  }
  const accessKey = (designId: string, uid: string) =>
    createHash("sha256").update(`${designId}:${uid}`).digest("hex");
  async function canUseProject(uid: string, product: any) {
    if (product.design?.format !== "aura-studio" || product.ownerId === uid)
      return true;
    if (product.published === false) return false;
    if (product.patternAccess === "public") return true;
    const permission = await store().get(
      `designAccess/${accessKey(product.id, uid)}`,
    );
    return (
      permission?.requesterId === uid &&
      permission?.ownerId === product.ownerId &&
      permission?.status === "approved"
    );
  }
  async function publicProducts() {
    const saved = hasStore ? await store().list("products") : [];
    const all = new Map<string, any>(seeds.map((p) => [p.id, p]));
    saved.filter((p) => p.published !== false).forEach((p) => all.set(p.id, p));
    return Promise.all(
      [...all.values()].map(async (p) => {
        const stats = hasStore
          ? await store().get(`productStats/${p.id}`)
          : null;
        return {
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.image,
          category: p.category,
          gender: p.gender,
          rating: p.rating,
          description: p.description,
          source: p.source,
          hasPattern: p.design?.format === "aura-studio",
          patternAccess:
            p.design?.format === "aura-studio"
              ? p.patternAccess || "approval"
              : null,
          createdAt: p.createdAt || 0,
          likes: stats?.likes || 0,
          tryOnEnabled: eligible(p),
          tryOnPrice: costs.tryon || null,
        };
      }),
    );
  }
  app.get(
    "/api/products",
    route(async (_req: any, res: any) => res.json(await publicProducts())),
  );
  app.get(
    "/api/products/:id",
    route(async (req: any, res: any) => {
      const p = await findProduct(idSchema.parse(req.params.id));
      res.json({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image,
        category: p.category,
        gender: p.gender,
        rating: p.rating,
        description: p.description,
        source: p.source,
        hasPattern: p.design?.format === "aura-studio",
        patternAccess:
          p.design?.format === "aura-studio"
            ? p.patternAccess || "approval"
            : null,
        tryOnEnabled: eligible(p),
        tryOnPrice: costs.tryon || null,
      });
    }),
  );
  app.get(
    "/api/boutiques",
    route(async (_req: any, res: any) =>
      res.json(
        hasStore
          ? (await store().list("boutiques"))
              .filter((b) => b.active === true)
              .map(({ id, name, city }: any) => ({ id, name, city }))
          : [],
      ),
    ),
  );
  app.get(
    "/api/designs/:id/image",
    route(async (req: any, res: any) => {
      const product = await findProduct(idSchema.parse(req.params.id));
      check(product.imagePath, 404, "Image was not found.");
      res.type("png").send(await store().image(product.imagePath));
    }),
  );
  app.all(
    ["/api/proxy-image", "/api/tryon", "/api/process-sketch"],
    (_req, res) =>
      res.status(410).json({
        error:
          "Use the paid order flow. Public image proxy and unpaid generation are disabled.",
      }),
  );
  app.use("/api", (req: any, _res, next) => {
    Promise.resolve()
      .then(async () => {
        const token = /^Bearer (.+)$/.exec(
          req.headers.authorization || "",
        )?.[1];
        check(token, 401, "Please log in to continue.");
        try {
          req.user = await (deps.verify || verifyToken)(token);
        } catch {
          throw new ApiError(401, "Please log in again.");
        }
        check(req.user?.uid, 401, "Invalid account.");
        store();
        next();
      })
      .catch(next);
  });
  mountMeshy(app, env, store, deps.meshyFetch);
  app.get(
    "/api/me",
    route(async (req: any, res: any) => {
      const entitlement = (await store().get(
        `entitlements/${req.user.uid}`,
      )) || { credits: [] };
      const credits = await Promise.all(
        (entitlement.credits || []).map(
          async (id: string) =>
            (await store().get(`orders/${id}`))?.status === "paid",
        ),
      );
      const passes = await Promise.all(
        (entitlement.passes || []).map(async (p: any) =>
          p.expiresAt > Date.now() &&
          p.remaining > 0 &&
          (await store().get(`orders/${p.orderId}`))?.status === "paid"
            ? p
            : null,
        ),
      );
      const active = passes.filter(Boolean);
      res.json({
        publishCredits: credits.filter(Boolean).length,
        pass: active.length
          ? {
              remaining: active.reduce((n, p) => n + p.remaining, 0),
              expiresAt: Math.max(...active.map((p) => p.expiresAt)),
            }
          : null,
      });
    }),
  );
  app.get(
    "/api/orders",
    route(async (req: any, res: any) =>
      res.json(
        (await store().where("orders", "uid", req.user.uid))
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((o) => ({
            id: o.id,
            kind: o.kind,
            status: o.status,
            amount: o.amount,
            createdAt: o.createdAt,
          })),
      ),
    ),
  );
  app.post(
    "/api/checkout",
    route(async (req: any, res: any) => {
      check(ready, 503, "Payments are not configured yet.");
      const body = z
        .object({
          kind: z.enum(["tryon", "render", "publish", "pass"]),
          productId: idSchema.optional(),
        })
        .parse(req.body);
      let product: any;
      if (body.kind === "tryon") {
        check(readyAI, 503, "Try-on is not configured yet.");
        product = await findProduct(body.productId || "");
        check(
          await canUseProject(req.user.uid, product),
          403,
          "The designer must approve access before you pay for this custom try-on.",
        );
        check(
          eligible(product),
          400,
          "This product is not approved for try-on.",
        );
        check(
          approvedImageUrl(product.image),
          400,
          "This product needs an approved image before payment.",
        );
      }
      if (body.kind === "render")
        check(readyAI, 503, "AI rendering is not configured yet.");
      const amount = ["tryon", "render"].includes(body.kind)
        ? costs.tryon
        : body.kind === "publish"
          ? costs.publish
          : costs.membership;
      check(amount > 0, 503, "Pricing is not configured.");
      if (body.kind === "pass") {
        const ent = await store().get(`entitlements/${req.user.uid}`);
        const active = await Promise.all(
          (ent?.passes || []).map(
            async (p: any) =>
              p.expiresAt > Date.now() &&
              p.remaining > 0 &&
              (await store().get(`orders/${p.orderId}`))?.status === "paid",
          ),
        );
        check(
          !active.some(Boolean),
          409,
          "Your publishing pass is still active.",
        );
      }
      const order = {
        id: randomUUID(),
        uid: req.user.uid,
        kind: body.kind,
        productId: product?.id || null,
        productImage: product?.image || null,
        amount,
        currency: "inr",
        status: "pending",
        createdAt: Date.now(),
        label:
          body.kind === "tryon"
            ? `One try-on: ${product.name}`
            : body.kind === "render"
              ? "One AI design render"
              : body.kind === "pass"
                ? "30-day publishing pass (30 uploads, no auto-renewal)"
                : "One design publication",
      };
      await store().transaction(async (tx) => {
        tx.set(`orders/${order.id}`, order);
      });
      const checkout = await payments.checkout(order, appUrl);
      await store().transaction(async (tx) => {
        const current = await tx.get(`orders/${order.id}`);
        tx.set(`orders/${order.id}`, { ...current, checkoutId: checkout.id });
      });
      res.json({ orderId: order.id, url: checkout.url });
    }),
  );
  async function ownOrder(req: any) {
    const order = await store().get(`orders/${idSchema.parse(req.params.id)}`);
    check(order && order.uid === req.user.uid, 404, "Order was not found.");
    return order;
  }
  app.post(
    "/api/orders/:id/reconcile",
    route(async (req: any, res: any) => {
      const order = await ownOrder(req);
      if (order.status === "pending" && order.checkoutId && payments.session)
        await fulfillSession(await payments.session(order.checkoutId));
      if (
        order.status === "running" &&
        order.startedAt < Date.now() - 20 * 60000
      ) {
        await store().transaction(async (tx) => {
          const o = await tx.get(`orders/${order.id}`);
          check(
            o.status === "running" && o.startedAt < Date.now() - 20 * 60000,
            409,
            "This job is still processing.",
          );
          tx.set(`orders/${o.id}`, { ...o, status: "refund_pending" });
        });
        await payments.refund(order);
        await store().transaction(async (tx) => {
          const o = await tx.get(`orders/${order.id}`);
          tx.set(`orders/${o.id}`, { ...o, status: "refunded" });
        });
      }
      res.json({ status: (await store().get(`orders/${order.id}`)).status });
    }),
  );
  app.get(
    "/api/orders/:id",
    route(async (req: any, res: any) => {
      const o = await ownOrder(req);
      res.json({
        id: o.id,
        kind: o.kind,
        productId: o.productId,
        amount: o.amount,
        status: o.status,
        createdAt: o.createdAt,
        resultAvailable:
          o.status === "completed" &&
          !!o.imagePath &&
          o.resultExpiresAt > Date.now(),
      });
    }),
  );
  app.post(
    "/api/orders/:id/refund",
    route(async (req: any, res: any) => {
      const order = await ownOrder(req);
      check(
        ["tryon", "render"].includes(order.kind),
        400,
        "Contact support for publishing refunds.",
      );
      await store().transaction(async (tx) => {
        const o = await tx.get(`orders/${order.id}`);
        check(
          ["paid", "refund_pending", "refunded"].includes(o.status),
          409,
          "Only unused or failed jobs can be refunded here.",
        );
        if (o.status !== "refunded")
          tx.set(`orders/${o.id}`, { ...o, status: "refund_pending" });
      });
      if (order.status !== "refunded") {
        await payments.refund(order);
        await store().transaction(async (tx) => {
          const o = await tx.get(`orders/${order.id}`);
          tx.set(`orders/${o.id}`, { ...o, status: "refunded" });
        });
      }
      res.json({ status: "refunded" });
    }),
  );
  app.get(
    "/api/orders/:id/result",
    route(async (req: any, res: any) => {
      const o = await ownOrder(req);
      check(
        o.status === "completed" &&
          o.imagePath &&
          o.resultExpiresAt > Date.now(),
        404,
        "Result has expired or is unavailable.",
      );
      res.type(o.resultMime).send(await store().image(o.imagePath));
    }),
  );
  app.delete(
    "/api/orders/:id/result",
    route(async (req: any, res: any) => {
      const order = await ownOrder(req);
      if (order.imagePath) await store().deleteImage(order.imagePath);
      await store().transaction(async (tx) => {
        const o = await tx.get(`orders/${order.id}`);
        tx.set(`orders/${o.id}`, { ...o, imagePath: null, resultExpiresAt: 0 });
      });
      res.json({ deleted: true });
    }),
  );
  async function loadCatalogImage(url: string) {
    if (url.startsWith("/api/designs/")) {
      const match = /^\/api\/designs\/([a-zA-Z0-9_-]+)\/image$/.exec(url);
      check(match, 400, "Invalid garment image.");
      const p = await findProduct(match[1]);
      return parseImage(
        `data:image/png;base64,${(await store().image(p.imagePath)).toString("base64")}`,
      );
    }
    const u = new URL(url);
    const hosts = new Set([
      "images.unsplash.com",
      "burst.shopifycdn.com",
      ...(env.APPROVED_IMAGE_HOSTS || "").split(",").filter(Boolean),
    ]);
    check(
      u.protocol === "https:" &&
        !u.port &&
        !u.username &&
        !u.password &&
        hosts.has(u.hostname),
      400,
      "The product image needs an approved image host.",
    );
    const response = await fetch(u, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    check(response.ok, 502, "Could not load the garment image.");
    const contentType = response.headers.get("content-type")?.split(";")[0];
    check(
      ["image/png", "image/jpeg", "image/webp"].includes(contentType || ""),
      400,
      "Unsupported garment image.",
    );
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of response.body as any) {
      bytes += chunk.length;
      check(bytes <= 3 * 1024 * 1024, 400, "Garment image is too large.");
      chunks.push(Buffer.from(chunk));
    }
    return parseImage(
      `data:${contentType};base64,${Buffer.concat(chunks).toString("base64")}`,
    );
  }
  app.post(
    "/api/orders/:id/run",
    route(async (req: any, res: any) => {
      check(readyAI && ready, 503, "AI generation is not configured yet.");
      const order = await ownOrder(req);
      check(
        ["tryon", "render"].includes(order.kind),
        400,
        "This order is not for AI generation.",
      );
      if (order.status === "completed")
        return res.json({ status: "completed" });
      check(
        order.status === "paid",
        409,
        "This payment is not available for generation. Check its status.",
      );
      check(
        req.body?.consent === true,
        400,
        "Photo processing consent is required.",
      );
      const parts: any[] = [];
      if (order.kind === "tryon") {
        const person = parseImage(req.body.userImage);
        const p = await findProduct(order.productId);
        check(
          await canUseProject(req.user.uid, p),
          403,
          "Design access has changed. You can refund this unused payment.",
        );
        check(
          eligible(p),
          409,
          "This product is no longer approved. Request a refund for this unused try-on.",
        );
        const garment = await loadCatalogImage(order.productImage);
        parts.push(
          {
            text: "Create an illustrative virtual try-on: the person in image one wearing the garment in image two. Preserve identity and pose. Output one image. This is a visualization, not a fit measurement.",
          },
          { inlineData: { mimeType: person.mimeType, data: person.data } },
          { inlineData: { mimeType: garment.mimeType, data: garment.data } },
        );
      } else {
        const sketch = parseImage(req.body.sketchImage);
        const instructions = z
          .string()
          .max(1000)
          .parse(req.body.instructions || "");
        parts.push(
          {
            text: `Render this garment sketch as a fashion concept. Output one image. Design instructions: ${instructions}`,
          },
          { inlineData: { mimeType: sketch.mimeType, data: sketch.data } },
        );
      }
      const day = new Date().toISOString().slice(0, 10);
      const reserved = await store().transaction(async (tx) => {
        const o = await tx.get(`orders/${order.id}`);
        const budget = (await tx.get(`budgets/${day}`)) || { spent: 0 };
        const ub = (await tx.get(`userBudgets/${req.user.uid}_${day}`)) || {
          jobs: 0,
        };
        if (o.status === "completed") return false;
        check(
          o.status === "paid",
          409,
          "This payment is already in use or was refunded. Check its status.",
        );
        check(
          budget.spent + costs.provider + costs.overhead <= costs.dailyBudget,
          429,
          "Today’s generation limit has been reached. You can refund this unused try-on.",
        );
        check(
          ub.jobs < costs.perUser,
          429,
          "Your daily generation limit has been reached. You can refund this unused try-on.",
        );
        tx.set(`budgets/${day}`, {
          spent: budget.spent + costs.provider + costs.overhead,
        });
        tx.set(`userBudgets/${req.user.uid}_${day}`, { jobs: ub.jobs + 1 });
        tx.set(`orders/${o.id}`, {
          ...o,
          status: "running",
          startedAt: Date.now(),
        });
        return true;
      });
      if (!reserved) return res.json({ status: "completed" });
      try {
        const output = parseImage(await generate(parts), 8 * 1024 * 1024);
        const imagePath = `results/${order.uid}/${order.id}`;
        await store().saveImage(imagePath, output.buffer, output.mimeType);
        await store().transaction(async (tx) => {
          const o = await tx.get(`orders/${order.id}`);
          check(o.status === "running", 409, "Order changed while processing.");
          tx.set(`orders/${o.id}`, {
            ...o,
            status: "completed",
            imagePath,
            resultMime: output.mimeType,
            resultExpiresAt: Date.now() + 7 * 86400000,
          });
        });
        res.json({ status: "completed" });
      } catch {
        await store().transaction(async (tx) => {
          const o = await tx.get(`orders/${order.id}`);
          if (o.status === "running")
            tx.set(`orders/${o.id}`, {
              ...o,
              status: "refund_pending",
              failedAt: Date.now(),
            });
        });
        try {
          await payments.refund(order);
          await store().transaction(async (tx) => {
            const o = await tx.get(`orders/${order.id}`);
            tx.set(`orders/${o.id}`, { ...o, status: "refunded" });
          });
        } catch {
          /* Retry via refund endpoint or reconciliation. */
        }
        throw new ApiError(
          502,
          "Generation failed. Check the order for its refund status. No automatic generation retry was made.",
        );
      }
    }),
  );
  app.post(
    "/api/designs",
    route(async (req: any, res: any) => {
      const body = z
        .object({
          requestId: idSchema,
          design: z.union([designSchema, projectSchema]),
          image: z.string(),
          rights: z.literal(true),
          gender: z.enum(["men", "women"]),
          patternAccess: z.enum(["public", "approval"]).default("approval"),
          dataConsent: z.literal(true).optional(),
        })
        .parse(req.body);
      check(
        !("format" in body.design) || body.dataConsent === true,
        400,
        "Confirm permission to share this project and its measurements.",
      );
      check(
        JSON.stringify(body.design).length < 600000,
        400,
        "Design is too large.",
      );
      const image = parseImage(body.image, 512000);
      check(image.mimeType === "image/png", 400, "Export your design as PNG.");
      const id = body.requestId,
        uid = req.user.uid;
      const existing = await store().get(`products/${id}`);
      if (existing) {
        check(
          existing.ownerId === uid,
          409,
          "Please use a new publication ID.",
        );
        return res.json({ id });
      }
      const imagePath = `designs/${uid}/${randomUUID()}.png`;
      await store().saveImage(imagePath, image.buffer, image.mimeType);
      let used = false;
      try {
        await store().transaction(async (tx) => {
          const previous = await tx.get(`products/${id}`);
          const ent = (await tx.get(`entitlements/${uid}`)) || { credits: [] };
          const orders = await Promise.all(
            (ent.credits || []).map((c: string) => tx.get(`orders/${c}`)),
          );
          const passes = ent.passes || [];
          const passOrders = await Promise.all(
            passes.map((p: any) => tx.get(`orders/${p.orderId}`)),
          );
          if (previous) {
            check(
              previous.ownerId === uid,
              409,
              "Publication ID already exists.",
            );
            return;
          }
          const passIndex = passes.findIndex(
            (p: any, i: number) =>
              p.expiresAt > Date.now() &&
              p.remaining > 0 &&
              passOrders[i]?.status === "paid",
          );
          const pass = passes[passIndex];
          const passValid = passIndex >= 0;
          const credit = orders.find((o: any) => o?.status === "paid");
          check(
            passValid || credit,
            402,
            "Buy one publication or an active publishing pass first.",
          );
          tx.set(`entitlements/${uid}`, {
            ...ent,
            ...(passValid
              ? {
                  passes: passes.map((p: any, i: number) =>
                    i === passIndex ? { ...p, remaining: p.remaining - 1 } : p,
                  ),
                }
              : {
                  credits: ent.credits.filter((c: string) => c !== credit.id),
                }),
          });
          tx.set(`products/${id}`, {
            id,
            name: body.design.name,
            ownerId: uid,
            image: `/api/designs/${id}/image`,
            imagePath,
            category:
              "format" in body.design
                ? body.design.garment === "blouse"
                  ? "shirts"
                  : "dresses"
                : body.design.template === "shirt"
                  ? "shirts"
                  : body.design.template === "saree"
                    ? "saries"
                    : "dresses",
            gender: body.gender,
            price: 0,
            rating: 0,
            description:
              "Community design. Request a boutique quote to have it made.",
            source: "designer",
            published: true,
            tryOnEnabled: false,
            createdAt: Date.now(),
            grantOrderId: passValid ? pass.orderId : credit.id,
            design: body.design,
            patternAccess: body.patternAccess,
          });
          used = true;
        });
      } catch (error) {
        await store().deleteImage(imagePath);
        throw error;
      }
      if (!used) await store().deleteImage(imagePath);
      res.json({ id });
    }),
  );
  app.post(
    "/api/products/:id/like",
    route(async (req: any, res: any) => {
      const id = idSchema.parse(req.params.id);
      await findProduct(id);
      const liked = z.boolean().parse(req.body.liked);
      const value = await store().transaction(async (tx) => {
        const path = `productStats/${id}/likes/${req.user.uid}`;
        const prev = await tx.get(path);
        const stats = (await tx.get(`productStats/${id}`)) || { likes: 0 };
        const count = Math.max(
          0,
          stats.likes + (liked && !prev ? 1 : !liked && prev ? -1 : 0),
        );
        if (liked) tx.set(path, { uid: req.user.uid });
        else tx.delete(path);
        tx.set(`productStats/${id}`, { likes: count });
        return count;
      });
      res.json({ likes: value, liked });
    }),
  );
  app.get(
    "/api/my-designs",
    route(async (req: any, res: any) => {
      const designs = await store().where("products", "ownerId", req.user.uid);
      res.json(
        await Promise.all(
          designs.map(async (d) => ({
            id: d.id,
            name: d.name,
            image: d.image,
            published: d.published !== false,
            patternAccess: d.patternAccess || "approval",
            hasPattern: d.design?.format === "aura-studio",
            createdAt: d.createdAt,
            likes: (await store().get(`productStats/${d.id}`))?.likes || 0,
          })),
        ),
      );
    }),
  );
  app.patch(
    "/api/my-designs/:id",
    route(async (req: any, res: any) => {
      const id = idSchema.parse(req.params.id),
        body = z
          .object({
            published: z.boolean(),
            patternAccess: z.enum(["public", "approval"]),
          })
          .parse(req.body);
      await store().transaction(async (tx) => {
        const design = await tx.get(`products/${id}`);
        check(
          design && design.ownerId === req.user.uid,
          404,
          "Design was not found.",
        );
        tx.set(`products/${id}`, { ...design, ...body, updatedAt: Date.now() });
      });
      res.json({ updated: true });
    }),
  );
  app.get(
    "/api/designs/:id/project",
    route(async (req: any, res: any) => {
      const id = idSchema.parse(req.params.id),
        product = await store().get(`products/${id}`);
      check(
        product?.design?.format === "aura-studio",
        404,
        "Editable project was not found.",
      );
      check(
        product.ownerId === req.user.uid ||
          (product.published !== false &&
            (await canUseProject(req.user.uid, { ...product, id }))),
        403,
        "Request the designer’s approval before opening this project.",
      );
      res.json(projectSchema.parse(product.design));
    }),
  );
  app.post(
    "/api/designs/:id/access-requests",
    route(async (req: any, res: any) => {
      const id = idSchema.parse(req.params.id),
        body = z
          .object({ message: z.string().trim().min(10).max(500) })
          .parse(req.body),
        key = accessKey(id, req.user.uid),
        day = new Date().toISOString().slice(0, 10);
      let status = "pending";
      await store().transaction(async (tx) => {
        const product = await tx.get(`products/${id}`),
          previous = await tx.get(`designAccess/${key}`),
          limits = (await tx.get(
            `permissionLimits/${accessKey(day, req.user.uid)}`,
          )) || { count: 0 };
        check(
          product?.published !== false &&
            product?.design?.format === "aura-studio",
          404,
          "Design was not found.",
        );
        check(
          product.ownerId !== req.user.uid,
          400,
          "You already own this project.",
        );
        check(
          product.patternAccess !== "public",
          409,
          "This project is already available to signed-in users.",
        );
        if (previous) {
          check(
            previous.ownerId === product.ownerId &&
              previous.requesterId === req.user.uid,
            409,
            "The design owner has changed.",
          );
          check(
            !["rejected", "revoked"].includes(previous.status),
            409,
            "Access was declined or revoked. Please respect the designer’s decision.",
          );
          status = previous.status;
          return;
        }
        check(
          limits.count < 10,
          429,
          "You have reached today’s design request limit.",
        );
        tx.set(`designAccess/${key}`, {
          id: key,
          designId: id,
          designName: product.name,
          ownerId: product.ownerId,
          requesterId: req.user.uid,
          message: body.message,
          status: "pending",
          createdAt: Date.now(),
          reply: "",
        });
        tx.set(`permissionLimits/${accessKey(day, req.user.uid)}`, {
          count: limits.count + 1,
        });
      });
      res.json({ id: key, status });
    }),
  );
  app.get(
    "/api/access-requests",
    route(async (req: any, res: any) => {
      const [owned, requested] = await Promise.all([
        store().where("designAccess", "ownerId", req.user.uid),
        store().where("designAccess", "requesterId", req.user.uid),
      ]);
      res.json(
        [
          ...new Map([...owned, ...requested].map((r) => [r.id, r])).values(),
        ].sort((a, b) => b.createdAt - a.createdAt),
      );
    }),
  );
  app.patch(
    "/api/access-requests/:id",
    route(async (req: any, res: any) => {
      const id = idSchema.parse(req.params.id),
        body = z
          .object({
            status: z.enum(["approved", "rejected", "revoked"]),
            reply: z.string().trim().max(500).default(""),
          })
          .parse(req.body);
      await store().transaction(async (tx) => {
        const request = await tx.get(`designAccess/${id}`);
        check(
          request && request.ownerId === req.user.uid,
          404,
          "Access request was not found.",
        );
        const product = await tx.get(`products/${request.designId}`);
        check(
          product?.ownerId === req.user.uid,
          403,
          "Only the current design owner can decide this request.",
        );
        tx.set(`designAccess/${id}`, {
          ...request,
          ...body,
          updatedAt: Date.now(),
        });
      });
      res.json({ updated: true });
    }),
  );
  app.get(
    "/api/likes",
    route(async (req: any, res: any) => {
      const products = await publicProducts();
      const liked = await Promise.all(
        products.map(async (p) =>
          (await store().get(`productStats/${p.id}/likes/${req.user.uid}`))
            ? p.id
            : null,
        ),
      );
      res.json(liked.filter(Boolean));
    }),
  );
  app.post(
    "/api/quotes",
    route(async (req: any, res: any) => {
      const body = z
        .object({
          productId: idSchema,
          boutiqueId: idSchema,
          notes: z.string().trim().min(10).max(1000),
          budgetPaise: z.number().int().min(100).max(100000000),
          consent: z.literal(true),
          requestId: idSchema,
        })
        .parse(req.body);
      const p = await findProduct(body.productId);
      const b = await store().get(`boutiques/${body.boutiqueId}`);
      check(
        b?.active === true && b.ownerId,
        400,
        "Select an available boutique.",
      );
      await store().transaction(async (tx) => {
        const prev = await tx.get(`quotes/${body.requestId}`);
        if (prev) {
          check(prev.uid === req.user.uid, 409, "Quote ID already exists.");
          return;
        }
        tx.set(`quotes/${body.requestId}`, {
          id: body.requestId,
          uid: req.user.uid,
          boutiqueId: body.boutiqueId,
          boutiqueOwner: b.ownerId,
          boutiqueName: b.name,
          productId: p.id,
          productName: p.name,
          productImage: p.image,
          notes: body.notes,
          budgetPaise: body.budgetPaise,
          status: "requested",
          createdAt: Date.now(),
        });
      });
      res.json({ id: body.requestId, status: "requested" });
    }),
  );
  app.get(
    "/api/quotes",
    route(async (req: any, res: any) => {
      const [own, assigned] = await Promise.all([
        store().where("quotes", "uid", req.user.uid),
        store().where("quotes", "boutiqueOwner", req.user.uid),
      ]);
      res.json(
        [...new Map([...own, ...assigned].map((q) => [q.id, q])).values()].sort(
          (a, b) => b.createdAt - a.createdAt,
        ),
      );
    }),
  );
  app.patch(
    "/api/quotes/:id",
    route(async (req: any, res: any) => {
      const body = z
        .object({
          pricePaise: z.number().int().min(100).max(100000000),
          reply: z.string().trim().min(5).max(1000),
        })
        .parse(req.body);
      const id = idSchema.parse(req.params.id);
      await store().transaction(async (tx) => {
        const q = await tx.get(`quotes/${id}`);
        check(
          q && q.boutiqueOwner === req.user.uid,
          404,
          "Quote was not found.",
        );
        tx.set(`quotes/${id}`, {
          ...q,
          ...body,
          status: "quoted",
          quotedAt: Date.now(),
        });
      });
      res.json({ status: "quoted" });
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint was not found." }),
  );
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err instanceof z.ZodError ? 400 : err.status || 500;
    res.status(status).json({
      error:
        err instanceof z.ZodError
          ? "Please check the supplied fields."
          : status >= 500 && !(err instanceof ApiError)
            ? "The service is unavailable. Please try again later."
            : err.message,
    });
  });
  return app;
}
