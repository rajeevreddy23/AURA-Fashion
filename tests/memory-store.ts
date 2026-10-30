import { Store, Tx } from "../server/store";
export class MemoryStore implements Store {
  documents = new Map<string, any>();
  images = new Map<string, Buffer>();
  private queue = Promise.resolve();
  async get(path: string) {
    return structuredClone(this.documents.get(path) || null);
  }
  async list(path: string) {
    return [...this.documents.entries()]
      .filter(
        ([key]) =>
          key.startsWith(path + "/") &&
          key.split("/").length === path.split("/").length + 1,
      )
      .map(([key, value]) => ({
        ...structuredClone(value),
        id: key.split("/").at(-1),
      }));
  }
  async where(path: string, field: string, value: string) {
    return (await this.list(path)).filter((d) => d[field] === value);
  }
  async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    let release: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => (release = resolve));
    await previous;
    const pending = new Map(this.documents);
    let wrote = false;
    try {
      const result = await work({
        get: async (path) => {
          if (wrote) throw new Error("Firestore reads must precede writes");
          return structuredClone(pending.get(path) || null);
        },
        set: (path, value) => {
          wrote = true;
          pending.set(path, structuredClone(value));
        },
        delete: (path) => {
          wrote = true;
          pending.delete(path);
        },
      });
      this.documents = pending;
      return result;
    } finally {
      release!();
    }
  }
  async saveImage(path: string, bytes: Buffer) {
    this.images.set(path, bytes);
  }
  async image(path: string) {
    const b = this.images.get(path);
    if (!b) throw new Error("Missing image");
    return b;
  }
  async deleteImage(path: string) {
    this.images.delete(path);
  }
}
