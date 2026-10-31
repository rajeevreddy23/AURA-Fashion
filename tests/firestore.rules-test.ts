import { test, before, after } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
let env: RulesTestEnvironment;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-aura-fashion",
    firestore: {
      host: "127.0.0.1",
      port: 8089,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "users/alice"), {
      uid: "alice",
      email: "alice@example.test",
      displayName: "Alice",
    });
    await setDoc(doc(c.firestore(), "orders/paid-order"), {
      uid: "alice",
      status: "paid",
    });
  });
});
after(async () => {
  await env?.cleanup();
});
const alice = () =>
  env
    .authenticatedContext("alice", { email: "alice@example.test" })
    .firestore();
test("client cannot forge a role or paid access while creating an account", async () => {
  const db = env
    .authenticatedContext("new-user", { email: "new@example.test" })
    .firestore();
  await assertFails(
    setDoc(doc(db, "users/new-user"), {
      uid: "new-user",
      email: "new@example.test",
      role: "admin",
    }),
  );
  await assertFails(
    setDoc(doc(db, "users/new-user"), {
      uid: "new-user",
      email: "new@example.test",
      subscription: { plan: "paid" },
      publishCredits: 99,
    }),
  );
  await assertSucceeds(
    setDoc(doc(db, "users/new-user"), {
      uid: "new-user",
      email: "new@example.test",
      displayName: "New creator",
      createdAt: new Date().toISOString(),
    }),
  );
});
test("profile updates cannot grant entitlements or change identity", async () => {
  const db = alice();
  await assertFails(
    updateDoc(doc(db, "users/alice"), { subscription: { plan: "premium" } }),
  );
  await assertFails(updateDoc(doc(db, "users/alice"), { role: "admin" }));
  await assertFails(
    updateDoc(doc(db, "users/alice"), { email: "other@example.test" }),
  );
  await assertSucceeds(
    updateDoc(doc(db, "users/alice"), { displayName: "Alice Updated" }),
  );
});
test("billing, counters, server orders, quote routing and AI results reject all direct client writes", async () => {
  const db = alice();
  for (const path of [
    "orders/fake",
    "entitlements/alice",
    "budgets/day",
    "userBudgets/day",
    "quotes/fake",
    "productStats/m1",
    "productStats/m1/likes/alice",
    "designAccess/forged-approval",
    "permissionLimits/alice-day",
    "users/alice/orders/fake",
    "users/alice/tryons/fake",
  ])
    await assertFails(
      setDoc(doc(db, path), { uid: "alice", status: "paid", credits: 999 }),
    );
  await assertFails(getDoc(doc(db, "orders/paid-order")));
  await assertFails(getDoc(doc(db, "designAccess/forged-approval")));
});
test("cart and drafts remain owner-only; catalog writes require a trusted custom admin claim", async () => {
  const db = alice();
  await assertSucceeds(
    setDoc(doc(db, "users/alice/cart/item"), { productId: "m1", quantity: 1 }),
  );
  await assertFails(
    getDoc(
      doc(env.authenticatedContext("bob").firestore(), "users/alice/cart/item"),
    ),
  );
  await assertSucceeds(
    setDoc(doc(db, "users/alice/sketches/draft"), { name: "Test" }),
  );
  await assertFails(
    setDoc(doc(db, "products/test"), { name: "Fake", published: true }),
  );
  await assertFails(
    setDoc(
      doc(
        env
          .authenticatedContext("email-user", {
            email: "rajeevreddyakepati@gmail.com",
            email_verified: true,
          })
          .firestore(),
        "products/test",
      ),
      { name: "Fake" },
    ),
  );
  await assertSucceeds(
    setDoc(
      doc(
        env.authenticatedContext("operator", { admin: true }).firestore(),
        "products/test",
      ),
      { name: "Approved", published: true },
    ),
  );
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), "products/test")),
  );
});
test("support messages retain private ownership and cannot be injected as already replied", async () => {
  const db = alice();
  const body = {
    userId: "alice",
    email: "alice@example.test",
    subject: "Order question",
    message: "Please review this order.",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await assertSucceeds(setDoc(doc(db, "supportMessages/test"), body));
  await assertFails(
    getDoc(
      doc(env.authenticatedContext("bob").firestore(), "supportMessages/test"),
    ),
  );
  await assertFails(
    setDoc(doc(db, "supportMessages/fake"), { ...body, status: "replied" }),
  );
});

// Exercise the actual Admin SDK transaction adapter against the local emulator.
test("real Firestore transactions prevent two publications from spending one paid entitlement", async () => {
  process.env.FIREBASE_PROJECT_ID = "demo-aura-fashion";
  process.env.FIREBASE_STORAGE_BUCKET = "demo-aura-fashion.appspot.com";
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8089";
  const { firestoreStore } = await import("../server/store");
  const { createApp } = await import("../server/app");
  const { blankDesign } = await import("../shared/studio");
  const store = firestoreStore();
  await store.transaction(async (tx) => {
    tx.set("orders/integration-credit", {
      id: "integration-credit",
      uid: "integration-user",
      status: "paid",
    });
    tx.set("entitlements/integration-user", {
      credits: ["integration-credit"],
    });
  });
  const images = new Map<string, Buffer>();
  const app = createApp({
    store: {
      ...store,
      saveImage: async (p, b) => {
        images.set(p, b);
      },
      deleteImage: async (p) => {
        images.delete(p);
      },
    },
    verify: async () => ({ uid: "integration-user" }),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const body = {
      design: blankDesign(),
      image:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=",
      rights: true,
      gender: "women",
    };
    const statuses = await Promise.all(
      ["integration-design-a", "integration-design-b"].map(
        async (id) =>
          (
            await fetch(base + "/api/designs", {
              method: "POST",
              headers: {
                Authorization: "Bearer integration-test",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...body, requestId: id }),
            })
          ).status,
      ),
    );
    if (
      statuses.filter((s) => s === 200).length !== 1 ||
      statuses.filter((s) => s === 402).length !== 1
    )
      throw new Error(`Unexpected publication results: ${statuses}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
