import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export interface Tx {
  get(path: string): Promise<any | null>;
  set(path: string, value: any): void;
  delete(path: string): void;
}
export interface Store {
  get(path: string): Promise<any | null>;
  list(collection: string): Promise<any[]>;
  where(collection: string, field: string, value: string): Promise<any[]>;
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
  saveImage(path: string, bytes: Buffer, contentType: string): Promise<void>;
  image(path: string): Promise<Buffer>;
  deleteImage(path: string): Promise<void>;
}
export function adminApp() {
  return (
    getApps()[0] ||
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    })
  );
}
export async function verifyToken(token: string) {
  return getAuth(adminApp()).verifyIdToken(token, true);
}
export function firestoreStore(): Store {
  const db = getFirestore(
    adminApp(),
    process.env.FIRESTORE_DATABASE_ID || "(default)",
  );
  const bucket = () => getStorage(adminApp()).bucket();
  return {
    async get(p) {
      const s = await db.doc(p).get();
      return s.exists ? s.data() : null;
    },
    async list(p) {
      const s = await db.collection(p).limit(100).get();
      return s.docs.map((d) => ({ ...d.data(), id: d.id }));
    },
    async where(p, f, v) {
      const s = await db.collection(p).where(f, "==", v).limit(100).get();
      return s.docs.map((d) => ({ ...d.data(), id: d.id }));
    },
    transaction(work) {
      return db.runTransaction((t) =>
        work({
          async get(p) {
            const s = await t.get(db.doc(p));
            return s.exists ? s.data() : null;
          },
          set(p, v) {
            t.set(db.doc(p), v);
          },
          delete(p) {
            t.delete(db.doc(p));
          },
        }),
      );
    },
    async saveImage(p, b, contentType) {
      await bucket()
        .file(p)
        .save(b, {
          resumable: false,
          metadata: { contentType, cacheControl: "private, no-store" },
        });
    },
    async image(p) {
      return (await bucket().file(p).download())[0];
    },
    async deleteImage(p) {
      await bucket().file(p).delete({ ignoreNotFound: true });
    },
  };
}
