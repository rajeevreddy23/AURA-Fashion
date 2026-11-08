import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../server/app";
import { MemoryStore } from "./memory-store";
async function fixture(
  options: {
    closed?: boolean;
    budget?: number;
    fail?: boolean;
    assetUrl?: string;
  } = {},
) {
  const store = new MemoryStore();
  const calls: { url: string; body: any }[] = [];
  const env = options.closed
    ? {}
    : {
        MESHY_API_KEY: "test-secret",
        MESHY_MODEL: "test-model",
        MESHY_TEXTURE_MODEL: "test-texture",
        MESHY_MAX_TASK_CREDITS: "30",
        MESHY_DAILY_CREDIT_BUDGET: String(options.budget || 90),
        MESHY_ALLOWED_UIDS: "alice,bob",
        APP_URL: "http://localhost:3001",
      };
  const meshyFetch = (async (url: any, init: any) => {
    calls.push({
      url: String(url),
      body: init?.body ? JSON.parse(init.body) : null,
    });
    if (init?.method === "POST") {
      if (options.fail) throw new Error("timeout after submission");
      return Response.json({ result: "task-123" });
    }
    if (String(url).startsWith("https://assets.meshy.ai"))
      return new Response(new Uint8Array([0x67, 0x6c, 0x54, 0x46]));
    return Response.json({
      status: "SUCCEEDED",
      progress: 100,
      model_urls: {
        glb: options.assetUrl || "https://assets.meshy.ai/model.glb",
      },
    });
  }) as typeof fetch;
  const app = createApp({
    env,
    store,
    verify: async (token) => ({ uid: token }),
    meshyFetch,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = (path: string, body?: any, uid: string | null = "alice") =>
    fetch(base + "/api/modeling" + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(uid ? { Authorization: `Bearer ${uid}` } : {}),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const body = () => ({
    requestId: randomUUID(),
    kind: "text",
    prompt: "A full-length bridal avatar",
    consent: true,
  });
  return {
    store,
    calls,
    request,
    body,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
test("Meshy requires configuration, identity, approved account and consent before provider calls", async () => {
  const closed = await fixture({ closed: true });
  try {
    assert.equal((await closed.request("/tasks", closed.body())).status, 503);
    assert.equal(closed.calls.length, 0);
  } finally {
    await closed.close();
  }
  const f = await fixture();
  try {
    assert.equal((await f.request("/tasks", f.body(), null)).status, 401);
    assert.equal((await f.request("/tasks", f.body(), "mallory")).status, 403);
    assert.equal(
      (await f.request("/tasks", { ...f.body(), consent: false })).status,
      400,
    );
    assert.equal(f.calls.length, 0);
  } finally {
    await f.close();
  }
});
test("Meshy duplicate concurrent submissions reserve and submit only once, protect ownership and download", async () => {
  const f = await fixture();
  try {
    const body = f.body();
    const responses = await Promise.all([
      f.request("/tasks", body),
      f.request("/tasks", body),
    ]);
    const jobs = await Promise.all(responses.map((r) => r.json()));
    assert.equal(jobs[0].id, jobs[1].id);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].body.mode, "preview");
    assert.equal(f.calls[0].body.ai_model, "test-model");
    assert.equal(
      (await f.request(`/tasks/${jobs[0].id}`, undefined, "bob")).status,
      404,
    );
    const task = await (await f.request(`/tasks/${jobs[0].id}`)).json();
    assert.equal(task.status, "SUCCEEDED");
    assert.equal(task.hasModel, true);
    assert.equal((await f.request(`/tasks/${jobs[0].id}/model`)).status, 200);
    assert.equal(
      JSON.stringify([...f.store.documents.values()]).includes("bridal avatar"),
      false,
    );
  } finally {
    await f.close();
  }
});
test("Meshy budgets enforce concurrent limits and ambiguous failures retain reservations", async () => {
  const f = await fixture({ budget: 30, fail: true });
  try {
    const body = f.body();
    const one = await (await f.request("/tasks", body)).json();
    assert.equal(
      (await (await f.request(`/tasks/${one.id}`)).json()).status,
      "SUBMISSION_UNKNOWN",
    );
    await f.request("/tasks", body);
    assert.equal(f.calls.length, 1);
    assert.equal((await f.request("/tasks", f.body())).status, 429);
    assert.equal(f.calls.length, 1);
  } finally {
    await f.close();
  }
  const concurrent = await fixture({ budget: 30 });
  try {
    const responses = await Promise.all([
      concurrent.request("/tasks", concurrent.body()),
      concurrent.request("/tasks", concurrent.body(), "bob"),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 429]);
    assert.equal(concurrent.calls.length, 1);
  } finally {
    await concurrent.close();
  }
});
test("Meshy rejects untrusted provider asset URLs and limits each account to three tasks", async () => {
  const f = await fixture({
    budget: 300,
    assetUrl: "http://127.0.0.1/private",
  });
  try {
    const one = await (await f.request("/tasks", f.body())).json();
    assert.equal((await f.request(`/tasks/${one.id}/model`)).status, 502);
    assert.equal(
      f.calls.some((c) => c.url.includes("127.0.0.1")),
      false,
    );
    await f.request("/tasks", f.body());
    await f.request("/tasks", f.body());
    assert.equal((await f.request("/tasks", f.body())).status, 429);
  } finally {
    await f.close();
  }
});

test("Meshy applies texture only to an owned completed model and forwards style without storing it", async () => {
  const f = await fixture({ budget: 300 });
  try {
    const original = await (await f.request("/tasks", f.body())).json();
    const style = {
      requestId: randomUUID(),
      kind: "retexture",
      sourceId: original.id,
      prompt: "Gold floral embroidery on ruby silk",
      consent: true,
    };
    assert.equal((await f.request("/tasks", style, "bob")).status, 404);
    const response = await f.request("/tasks", style);
    assert.equal(response.status, 200);
    const call = f.calls.find((c) => c.url.endsWith("/retexture") && c.body);
    assert.ok(call);
    assert.equal(call.body.input_task_id, "task-123");
    assert.equal(call.body.text_style_prompt, style.prompt);
    assert.equal(call.body.enable_original_uv, true);
    assert.equal(
      JSON.stringify([...f.store.documents.values()]).includes(style.prompt),
      false,
    );
    const changed = { ...style, prompt: "Different design" };
    assert.equal((await f.request("/tasks", changed)).status, 409);
  } finally {
    await f.close();
  }
});
