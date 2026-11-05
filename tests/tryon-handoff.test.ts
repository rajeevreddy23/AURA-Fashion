import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearTryOnPhoto,
  rememberTryOnPhoto,
  restoreTryOnPhoto,
  scopeTryOnPhotoToUser,
} from "../src/services/tryOnHandoff";
const photo = "data:image/png;base64,aGVsbG8=";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
    values,
  };
}
test("temporary checkout photos are limited to the same account/product and expire after thirty minutes", () => {
  const s = storage();
  rememberTryOnPhoto(s, "alice", "w1", photo, 1000);
  assert.equal(restoreTryOnPhoto(s, "alice", "w1", 2000), photo);
  assert.equal(restoreTryOnPhoto(s, "bob", "w1", 2000), "");
  assert.equal(s.values.size, 0);
  rememberTryOnPhoto(s, "alice", "w1", photo, 1000);
  assert.equal(restoreTryOnPhoto(s, "alice", "w2", 2000), "");
  rememberTryOnPhoto(s, "alice", "w1", photo, 1000);
  assert.equal(restoreTryOnPhoto(s, "alice", "w1", 1801000), "");
  rememberTryOnPhoto(s, "alice", "w1", photo, 1000);
  clearTryOnPhoto(s);
  assert.equal(s.values.size, 0);
});
test("auth restoration preserves the owner's photo while sign-out and account changes clear it", () => {
  const s = storage();
  rememberTryOnPhoto(s, "alice", "w1", photo, 1000);
  scopeTryOnPhotoToUser(s, "alice", 2000);
  assert.equal(restoreTryOnPhoto(s, "alice", "w1", 2000), photo);
  scopeTryOnPhotoToUser(s, "bob", 2000);
  assert.equal(s.values.size, 0);
  rememberTryOnPhoto(s, "alice", "w1", photo, 1000);
  scopeTryOnPhotoToUser(s, "", 2000);
  assert.equal(s.values.size, 0);
});
test("photo handoff rejects active formats and oversized input and fails before checkout if storage is unavailable", () => {
  const s = storage();
  assert.throws(() =>
    rememberTryOnPhoto(s, "alice", "w1", "data:image/svg+xml;base64,aGVsbG8="),
  );
  assert.throws(() =>
    rememberTryOnPhoto(s, "alice", "w1", photo + "A".repeat(4300000)),
  );
  assert.throws(() =>
    rememberTryOnPhoto(
      {
        ...s,
        setItem: () => {
          throw new Error("full");
        },
      },
      "alice",
      "w1",
      photo,
    ),
  );
  s.values.set("aura-tryon-handoff-v1", "invalid JSON");
  assert.equal(restoreTryOnPhoto(s, "alice", "w1"), "");
  assert.equal(s.values.size, 0);
});
