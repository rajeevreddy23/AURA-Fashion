import { Project, parseProject, projectSchema } from "../../shared/workspace";
export type SavedProject = {
  project: Project;
  revisions: {
    id: string;
    label: string;
    createdAt: number;
    project: Project;
  }[];
};
const DB = "aura-atelier-v2",
  STORE = "projects";
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE))
        r.result.createObjectStore(STORE, { keyPath: "key" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        new Error(
          "Project storage is unavailable. Export a backup to keep your work.",
        ),
      );
    r.onblocked = () =>
      reject(new Error("Close other AURA tabs to update project storage."));
  });
}
export async function saveProject(scope: string, value: SavedProject) {
  const project = projectSchema.parse(value.project);
  if (JSON.stringify(value).length > 12000000)
    throw new Error(
      "Project history is too large. Export older versions before continuing.",
    );
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        key: `${scope}:${project.id}`,
        scope,
        ...value,
        project,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new Error("Project could not be saved. Export a backup now."));
      tx.onabort = () =>
        reject(new Error("Saving was interrupted. Export a backup now."));
    });
  } finally {
    db.close();
  }
}
export async function listProjects(scope: string): Promise<SavedProject[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).getAll();
      r.onsuccess = () =>
        resolve(
          r.result
            .filter((x) => x.scope === scope)
            .flatMap((x) => {
              try {
                return [
                  {
                    project: parseProject(JSON.stringify(x.project)),
                    revisions: (x.revisions || [])
                      .slice(-20)
                      .filter(
                        (r: any) => projectSchema.safeParse(r.project).success,
                      ),
                  },
                ];
              } catch {
                return [];
              }
            })
            .sort((a, b) => b.project.updatedAt - a.project.updatedAt),
        );
      r.onerror = () =>
        reject(new Error("Saved projects could not be opened."));
    });
  } finally {
    db.close();
  }
}
export async function removeProject(scope: string, id: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(`${scope}:${id}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("Project could not be deleted."));
    });
  } finally {
    db.close();
  }
}
