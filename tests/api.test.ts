import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { createApp } from "../server/app";
import { pricing, parseImage } from "../server/policy";
import { blankDesign, designSchema, historyPush } from "../shared/studio";
import { MemoryStore } from "./memory-store";
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=";
const secret = "whsec_test_only";
async function fixture(
  options: {
    generate?: (parts: any[]) => Promise<string>;
    env?: NodeJS.ProcessEnv;
    closed?: boolean;
  } = {},
) {
  const store = new MemoryStore();
  let generated = 0,
    refunds = 0;
  const sessions: any[] = [];
  store.documents.set("products/approved", {
    id: "approved",
    name: "Approved test garment",
    category: "shirts",
    gender: "women",
    price: 100,
    tryOnEnabled: true,
    published: true,
    image: "/api/designs/approved/image",
    imagePath: "test/garment",
  });
  store.images.set("test/garment", Buffer.from(image.split(",")[1], "base64"));
  const env = {
    APP_URL: "http://localhost:3000",
    GEMINI_IMAGE_MODEL: "test-image-model",
    TRYON_PRICE_PAISE: "1000",
    PROVIDER_MAX_COST_PAISE: "200",
    JOB_OVERHEAD_PAISE: "100",
    DAILY_AI_BUDGET_PAISE: "3000",
    PUBLISH_PRICE_PAISE: "500",
    PUBLISH_PASS_PRICE_PAISE: "10000",
    ...options.env,
  };
  const payments = {
    checkout: async (order: any) => {
      sessions.push(order);
      return {
        id: `cs_${order.id}`,
        url: "https://checkout.stripe.com/c/pay/test",
      };
    },
    event: (body: Buffer, signature: string) =>
      Stripe.webhooks.constructEvent(body, signature, secret),
    refund: async () => {
      refunds++;
    },
  };
  const app = createApp(
    options.closed
      ? { env: {} }
      : {
          env,
          store,
          verify: async (token) => {
            if (token === "bad") throw new Error("bad");
            return { uid: token };
          },
          payments,
          generate: async (parts) => {
            generated++;
            return options.generate ? options.generate(parts) : image;
          },
        },
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as any;
  const base = `http://127.0.0.1:${address.port}`;
  async function request(
    path: string,
    body?: unknown,
    uid: string | null = "alice",
    method = body === undefined ? "GET" : "POST",
    headers: any = {},
  ) {
    const r = await fetch(base + "/api" + path, {
      method,
      headers: {
        ...(uid ? { Authorization: `Bearer ${uid}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  }
  async function pay(id: string, changes: any = {}) {
    const order = await store.get(`orders/${id}`);
    const event = {
      id: "evt_test",
      type: "checkout.session.completed",
      data: {
        object: {
          id: order.checkoutId,
          payment_status: "paid",
          mode: "payment",
          amount_total: order.amount,
          currency: "inr",
          payment_intent: `pi_${id}`,
          metadata: { orderId: id, uid: order.uid },
          ...changes,
        },
      },
    };
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    const r = await fetch(base + "/api/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    });
    return { status: r.status, data: await r.json() };
  }
  return {
    store,
    request,
    pay,
    sessions,
    get generated() {
      return generated;
    },
    get refunds() {
      return refunds;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
test("unsafe pricing fails closed and supported image types are checked against bytes", () => {
  assert.equal(
    pricing({ TRYON_PRICE_PAISE: "100", PROVIDER_MAX_COST_PAISE: "200" }).safe,
    false,
  );
  assert.equal(pricing({ TRYON_PRICE_PAISE: "NaN" }).safe, false);
  assert.equal(
    pricing({ TRYON_PRICE_PAISE: "1000", PROVIDER_MAX_COST_PAISE: "200" }).safe,
    true,
  );
  assert.equal(parseImage(image).mimeType, "image/png");
  assert.throws(() => parseImage(image.replace("image/png", "image/jpeg")));
  assert.throws(() => parseImage("data:image/svg+xml;base64,PHN2Zz4="));
  assert.throws(() => parseImage(image, 1));
});
test("import validation rejects active content, extreme coordinates and future file versions; history branches and is bounded", () => {
  assert.throws(() => designSchema.parse({ ...blankDesign(), version: 2 }));
  assert.throws(() =>
    designSchema.parse({
      ...blankDesign(),
      layers: [
        {
          id: "x",
          kind: "image",
          x: 0,
          y: 0,
          width: 40,
          height: 40,
          color: "#ffffff",
          stroke: 1,
          image: "data:image/svg+xml;base64,PHN2Zz4=",
        },
      ],
    }),
  );
  assert.deepEqual(historyPush([1, 2, 3], 0, 4), [1, 4]);
  assert.equal(
    historyPush(
      Array.from({ length: 50 }, (_, i) => i),
      49,
      51,
    ).length,
    50,
  );
});
test("unconfigured services expose no paid actions; legacy proxy and generation cannot bypass orders", async () => {
  const f = await fixture({ closed: true });
  try {
    const c = await f.request("/config", undefined, null);
    assert.equal(c.data.tryOnReady, false);
    assert.equal(c.data.publishingReady, false);
    assert.equal(
      (await f.request("/checkout", { kind: "render" }, null)).status,
      401,
    );
    for (const p of ["/tryon", "/process-sketch", "/proxy-image"])
      assert.equal((await f.request(p, {})).status, 410);
  } finally {
    await f.close();
  }
});
test("checkout requires valid identity, expected origin, product approval and server-owned price", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.request("/checkout", { kind: "render" }, null)).status,
      401,
    );
    assert.equal(
      (await f.request("/checkout", { kind: "render" }, "bad")).status,
      401,
    );
    assert.equal(
      (
        await f.request("/checkout", { kind: "render" }, "alice", "POST", {
          Origin: "https://evil.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (await f.request("/checkout", { kind: "tryon", productId: "m5" })).status,
      400,
    );
    assert.equal(
      (await f.request("/checkout", { kind: "tryon", productId: "missing" }))
        .status,
      404,
    );
    const r = await f.request("/checkout", {
      kind: "tryon",
      productId: "approved",
      amount: 1,
    });
    assert.equal(r.status, 200);
    assert.equal(f.sessions[0].amount, 1000);
    assert.equal(
      (await f.request(`/orders/${r.data.orderId}`, undefined, "bob")).status,
      404,
    );
  } finally {
    await f.close();
  }
});
test("signed webhook validates amount and paid status, and cannot grant duplicate upload credits", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.request("/payments/webhook", {
          type: "checkout.session.completed",
        })
      ).status,
      400,
    );
    const r = await f.request("/checkout", { kind: "publish" });
    const id = r.data.orderId;
    assert.equal((await f.pay(id, { amount_total: 1 })).status, 400);
    assert.equal((await f.store.get(`orders/${id}`)).status, "pending");
    assert.equal((await f.pay(id, { payment_status: "unpaid" })).status, 200);
    assert.equal((await f.store.get(`orders/${id}`)).status, "pending");
    assert.equal((await f.pay(id)).status, 200);
    await f.pay(id);
    assert.deepEqual((await f.store.get("entitlements/alice")).credits, [id]);
    assert.equal((await f.request("/me")).data.publishCredits, 1);
  } finally {
    await f.close();
  }
});
test("AI cannot run unpaid, without consent, or with an invalid photo", async () => {
  const f = await fixture();
  try {
    const {
      data: { orderId: id },
    } = await f.request("/checkout", { kind: "tryon", productId: "approved" });
    assert.equal(
      (
        await f.request(`/orders/${id}/run`, {
          userImage: image,
          consent: true,
        })
      ).status,
      409,
    );
    await f.pay(id);
    assert.equal(
      (await f.request(`/orders/${id}/run`, { userImage: image })).status,
      400,
    );
    assert.equal(
      (
        await f.request(`/orders/${id}/run`, {
          userImage: "bad",
          consent: true,
        })
      ).status,
      400,
    );
    assert.equal(f.generated, 0);
  } finally {
    await f.close();
  }
});
test("concurrent generation consumes one payment once; result is private and deletable", async () => {
  const f = await fixture({
    generate: async () => {
      await new Promise((r) => setTimeout(r, 30));
      return image;
    },
  });
  try {
    const {
      data: { orderId: id },
    } = await f.request("/checkout", { kind: "tryon", productId: "approved" });
    await f.pay(id);
    const responses = await Promise.all([
      f.request(`/orders/${id}/run`, { userImage: image, consent: true }),
      f.request(`/orders/${id}/run`, { userImage: image, consent: true }),
    ]);
    assert.ok(responses.some((r) => r.status === 200));
    assert.equal(f.generated, 1);
    await f.request(`/orders/${id}/run`, { userImage: image, consent: true });
    assert.equal(f.generated, 1);
    assert.equal(
      (await f.request(`/orders/${id}/result`, undefined, "bob")).status,
      404,
    );
    assert.equal(
      (await f.request(`/orders/${id}/result`, undefined, "alice", "DELETE"))
        .status,
      200,
    );
    assert.equal(
      (await f.request(`/orders/${id}`)).data.resultAvailable,
      false,
    );
    assert.equal(
      JSON.stringify([...f.store.documents.values()]).includes(image),
      false,
    );
  } finally {
    await f.close();
  }
});
test("provider failures never fabricate a result, reserve costs, and request an idempotent refund", async () => {
  const f = await fixture({
    generate: async () => {
      throw new Error("provider failure");
    },
  });
  try {
    const {
      data: { orderId: id },
    } = await f.request("/checkout", { kind: "render" });
    await f.pay(id);
    assert.equal(
      (
        await f.request(`/orders/${id}/run`, {
          sketchImage: image,
          consent: true,
        })
      ).status,
      502,
    );
    assert.equal((await f.store.get(`orders/${id}`)).status, "refunded");
    assert.equal(f.refunds, 1);
    assert.equal(f.generated, 1);
    assert.equal(
      (
        await f.request(`/orders/${id}/run`, {
          sketchImage: image,
          consent: true,
        })
      ).status,
      409,
    );
    assert.equal(f.generated, 1);
    assert.equal(
      (await f.store.get(`budgets/${new Date().toISOString().slice(0, 10)}`))
        .spent,
      300,
    );
  } finally {
    await f.close();
  }
});
test("daily global budget and account limit block provider spend without consuming an unused payment", async () => {
  for (const env of [
    { DAILY_AI_BUDGET_PAISE: "300" },
    { MAX_USER_DAILY_JOBS: "1" },
  ]) {
    const f = await fixture({ env });
    try {
      for (let n = 0; n < 2; n++) {
        const {
          data: { orderId: id },
        } = await f.request("/checkout", { kind: "render" });
        await f.pay(id);
        const r = await f.request(`/orders/${id}/run`, {
          sketchImage: image,
          consent: true,
        });
        assert.equal(r.status, n === 0 ? 200 : 429);
        if (n === 1) {
          assert.equal((await f.store.get(`orders/${id}`)).status, "paid");
          assert.equal(
            (await f.request(`/orders/${id}/refund`, {})).status,
            200,
          );
        }
      }
      assert.equal(f.generated, 1);
    } finally {
      await f.close();
    }
  }
});
test("publishing requires payment, is retry-safe and cannot consume one credit concurrently twice", async () => {
  const f = await fixture();
  const body = {
    requestId: "design-one",
    design: blankDesign(),
    image,
    rights: true,
    gender: "women",
  };
  try {
    assert.equal((await f.request("/designs", body)).status, 402);
    const {
      data: { orderId: id },
    } = await f.request("/checkout", { kind: "publish" });
    await f.pay(id);
    const rs = await Promise.all([
      f.request("/designs", body),
      f.request("/designs", { ...body, requestId: "design-two" }),
    ]);
    assert.equal(rs.filter((r) => r.status === 200).length, 1);
    assert.equal(rs.filter((r) => r.status === 402).length, 1);
    const winner = rs[0].status === 200 ? "design-one" : "design-two";
    assert.equal(
      (await f.request("/designs", { ...body, requestId: winner })).status,
      200,
    );
    assert.equal((await f.request("/me")).data.publishCredits, 0);
    assert.equal((await f.store.get(`products/${winner}`)).tryOnEnabled, false);
  } finally {
    await f.close();
  }
});
test("likes are unique per account and repeated unlike never creates negative ranking", async () => {
  const f = await fixture();
  try {
    await Promise.all(
      Array.from({ length: 4 }, () =>
        f.request("/products/approved/like", { liked: true }),
      ),
    );
    assert.equal((await f.store.get("productStats/approved")).likes, 1);
    await f.request("/products/approved/like", { liked: true }, "bob");
    assert.equal((await f.store.get("productStats/approved")).likes, 2);
    await f.request("/products/approved/like", { liked: false });
    await f.request("/products/approved/like", { liked: false });
    assert.equal((await f.store.get("productStats/approved")).likes, 1);
  } finally {
    await f.close();
  }
});
test("quote requests require consent and active boutique; only customer and assigned boutique can read or reply", async () => {
  const f = await fixture();
  f.store.documents.set("boutiques/shop", {
    id: "shop",
    name: "Test boutique",
    city: "Test city",
    ownerId: "tailor",
    active: true,
  });
  const body = {
    requestId: "quote-one",
    productId: "approved",
    boutiqueId: "shop",
    notes: "A cotton garment for a celebration",
    budgetPaise: 100000,
    consent: true,
  };
  try {
    assert.equal(
      (await f.request("/quotes", { ...body, consent: false })).status,
      400,
    );
    assert.equal((await f.request("/quotes", body)).status, 200);
    assert.equal((await f.request("/quotes")).data.length, 1);
    assert.equal((await f.request("/quotes", undefined, "bob")).data.length, 0);
    assert.equal(
      (
        await f.request(
          "/quotes/quote-one",
          { pricePaise: 120000, reply: "Ready in two weeks" },
          "bob",
          "PATCH",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await f.request(
          "/quotes/quote-one",
          { pricePaise: 120000, reply: "Ready in two weeks" },
          "tailor",
          "PATCH",
        )
      ).status,
      200,
    );
    assert.equal((await f.request("/quotes")).data[0].status, "quoted");
  } finally {
    await f.close();
  }
});

test("publishing passes preserve concurrently paid grants, enforce expiry, and consume one upload", async () => {
  const f = await fixture();
  try {
    const one = await f.request("/checkout", { kind: "pass" });
    const two = await f.request("/checkout", { kind: "pass" });
    await Promise.all([f.pay(one.data.orderId), f.pay(two.data.orderId)]);
    await f.pay(one.data.orderId);
    assert.equal((await f.request("/me")).data.pass.remaining, 60);
    assert.equal((await f.request("/checkout", { kind: "pass" })).status, 409);
    const body = {
      requestId: "pass-design",
      design: blankDesign(),
      image,
      rights: true,
      gender: "women",
    };
    assert.equal((await f.request("/designs", body)).status, 200);
    assert.equal((await f.request("/me")).data.pass.remaining, 59);
    const e = await f.store.get("entitlements/alice");
    e.passes = e.passes.map((p: any) => ({ ...p, expiresAt: Date.now() - 1 }));
    f.store.documents.set("entitlements/alice", e);
    assert.equal(
      (await f.request("/designs", { ...body, requestId: "expired-design" }))
        .status,
      402,
    );
  } finally {
    await f.close();
  }
});
test("a stalled reserved job can be recovered as a refund without another provider call", async () => {
  const f = await fixture();
  try {
    const {
      data: { orderId: id },
    } = await f.request("/checkout", { kind: "render" });
    await f.pay(id);
    const order = await f.store.get(`orders/${id}`);
    f.store.documents.set(`orders/${id}`, {
      ...order,
      status: "running",
      startedAt: Date.now() - 21 * 60000,
    });
    assert.equal((await f.request(`/orders/${id}/reconcile`, {})).status, 200);
    assert.equal((await f.store.get(`orders/${id}`)).status, "refunded");
    assert.equal(f.generated, 0);
    assert.equal(f.refunds, 1);
  } finally {
    await f.close();
  }
});

test("a manually approved product still needs an approved image host before checkout", async () => {
  const f = await fixture();
  try {
    f.store.documents.set("products/unsafe-image", {
      id: "unsafe-image",
      name: "Invalid image",
      tryOnEnabled: true,
      category: "shirts",
      image: "http://127.0.0.1/private",
      published: true,
    });
    assert.equal(
      (
        await f.request("/checkout", {
          kind: "tryon",
          productId: "unsafe-image",
        })
      ).status,
      400,
    );
    assert.equal(f.sessions.length, 0);
  } finally {
    await f.close();
  }
});
test("a verified full payment refund removes unused publishing access", async () => {
  const f = await fixture();
  try {
    const {
      data: { orderId: id },
    } = await f.request("/checkout", { kind: "publish" });
    await f.pay(id);
    const event = {
      type: "charge.refunded",
      data: {
        object: {
          refunded: true,
          payment_intent: `pi_${id}`,
          metadata: { orderId: id },
        },
      },
    };
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: JSON.stringify(event),
      secret,
    });
    assert.equal(
      (
        await f.request("/payments/webhook", event, null, "POST", {
          "stripe-signature": signature,
        })
      ).status,
      200,
    );
    assert.equal((await f.request("/me")).data.publishCredits, 0);
    assert.equal((await f.store.get(`orders/${id}`)).status, "refunded");
  } finally {
    await f.close();
  }
});

// Advanced project sharing is authorized independently of payment.
test("advanced publication requires measurement consent and public responses never disclose the project", async () => {
  const { createProject } = await import("../shared/workspace");
  const f = await fixture();
  try {
    const {
      data: { orderId: id },
    } = await f.request("/checkout", { kind: "publish" });
    await f.pay(id);
    const body = {
      requestId: "advanced-private-pattern",
      design: createProject(),
      image,
      rights: true,
      gender: "women",
      patternAccess: "approval",
    };
    assert.equal((await f.request("/designs", body)).status, 400);
    assert.equal((await f.request("/me")).data.publishCredits, 1);
    assert.equal(
      (await f.request("/designs", { ...body, dataConsent: true })).status,
      200,
    );
    const list = await f.request("/products", undefined, null);
    const publicDesign = list.data.find((p: any) => p.id === body.requestId);
    assert.equal(publicDesign.hasPattern, true);
    assert.equal(publicDesign.patternAccess, "approval");
    assert.equal(publicDesign.design, undefined);
    assert.equal(publicDesign.measurements, undefined);
    assert.equal(publicDesign.ownerId, undefined);
    assert.equal(
      (await f.request(`/designs/${body.requestId}/project`, undefined, "bob"))
        .status,
      403,
    );
    assert.equal(
      (await f.request(`/designs/${body.requestId}/project`)).data.format,
      "aura-studio",
    );
  } finally {
    await f.close();
  }
});
test("only the designer can grant or revoke editable access, and restricted try-on is blocked before charging", async () => {
  const { createProject } = await import("../shared/workspace");
  const f = await fixture();
  try {
    f.store.documents.set("products/advanced", {
      id: "advanced",
      ownerId: "alice",
      name: "Private pattern",
      published: true,
      patternAccess: "approval",
      category: "dresses",
      tryOnEnabled: true,
      design: createProject(),
      image: "/api/designs/approved/image",
      imagePath: "test/garment",
    });
    assert.equal(
      (
        await f.request(
          "/checkout",
          { kind: "tryon", productId: "advanced" },
          "bob",
        )
      ).status,
      403,
    );
    assert.equal(f.sessions.length, 0);
    const first = await f.request(
      "/designs/advanced/access-requests",
      { message: "I would like to make this design for myself." },
      "bob",
    );
    assert.equal(first.status, 200);
    const requestId = first.data.id;
    assert.equal(
      (
        await f.request(
          "/designs/advanced/access-requests",
          { message: "Please approve this design again." },
          "bob",
        )
      ).data.id,
      requestId,
    );
    assert.equal(
      (await f.request("/access-requests", undefined, "charlie")).data.length,
      0,
    );
    assert.equal(
      (
        await f.request(
          `/access-requests/${requestId}`,
          { status: "approved" },
          "bob",
          "PATCH",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await f.request(
          `/access-requests/${requestId}`,
          { status: "approved", reply: "Personal use only." },
          "alice",
          "PATCH",
        )
      ).status,
      200,
    );
    assert.equal(
      (await f.request("/designs/advanced/project", undefined, "bob")).status,
      200,
    );
    const paid = await f.request(
      "/checkout",
      { kind: "tryon", productId: "advanced" },
      "bob",
    );
    assert.equal(paid.status, 200);
    await f.pay(paid.data.orderId);
    assert.equal(
      (
        await f.request(
          `/access-requests/${requestId}`,
          { status: "revoked" },
          "alice",
          "PATCH",
        )
      ).status,
      200,
    );
    assert.equal(
      (await f.request("/designs/advanced/project", undefined, "bob")).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          `/orders/${paid.data.orderId}/run`,
          { userImage: image, consent: true },
          "bob",
        )
      ).status,
      403,
    );
    assert.equal(f.generated, 0);
    assert.equal(
      (await f.request(`/orders/${paid.data.orderId}/refund`, {}, "bob"))
        .status,
      200,
    );
  } finally {
    await f.close();
  }
});
test("private uploads can only be managed by their owner and hidden projects revoke future public access", async () => {
  const { createProject } = await import("../shared/workspace");
  const f = await fixture();
  try {
    f.store.documents.set("products/shared", {
      id: "shared",
      ownerId: "alice",
      name: "Shared pattern",
      published: true,
      patternAccess: "public",
      design: createProject(),
      image: "/api/designs/approved/image",
    });
    assert.equal(
      (await f.request("/designs/shared/project", undefined, "bob")).status,
      200,
    );
    assert.equal(
      (await f.request("/my-designs", undefined, "bob")).data.length,
      0,
    );
    assert.equal((await f.request("/my-designs")).data.length, 1);
    assert.equal(
      (
        await f.request(
          "/my-designs/shared",
          { published: false, patternAccess: "approval" },
          "bob",
          "PATCH",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await f.request(
          "/my-designs/shared",
          { published: false, patternAccess: "approval" },
          "alice",
          "PATCH",
        )
      ).status,
      200,
    );
    assert.equal(
      (await f.request("/products/shared", undefined, null)).status,
      404,
    );
    assert.equal(
      (await f.request("/designs/shared/project", undefined, "bob")).status,
      403,
    );
    assert.equal((await f.request("/designs/shared/project")).status, 200);
  } finally {
    await f.close();
  }
});
