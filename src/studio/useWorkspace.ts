import { useEffect, useRef, useState } from "react";
import { Project, createProject, projectSchema } from "../../shared/workspace";
import { listProjects, saveProject, SavedProject } from "./projectStore";
export function useWorkspace(scope: string) {
  const [history, setHistory] = useState(() => ({
    items: [createProject()],
    index: 0,
  }));
  const project = history.items[history.index];
  const [revisions, setRevisions] = useState<SavedProject["revisions"]>([]);
  const [library, setLibrary] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Opening local projects…");
  const [error, setError] = useState("");
  const valueRef = useRef<SavedProject>({ project, revisions });
  valueRef.current = { project, revisions };
  const queue = useRef(Promise.resolve());
  const loadedRef = useRef(false);
  const persist = (value: SavedProject) => {
    const run = queue.current
      .catch(() => {})
      .then(() => saveProject(scope, value));
    queue.current = run;
    return run;
  };
  useEffect(() => {
    let alive = true;
    listProjects(scope)
      .then((items) => {
        if (!alive) return;
        setLibrary(items);
        let activeId = "";
        try {
          activeId = localStorage.getItem(`aura-active-project:${scope}`) || "";
        } catch {}
        const found = items.find((x) => x.project.id === activeId) || items[0];
        if (found) {
          setHistory({ items: [found.project], index: 0 });
          setRevisions(found.revisions);
        }
        setLoading(false);
        loadedRef.current = true;
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [scope]);
  useEffect(() => {
    if (loading) return;
    setStatus("Saving locally…");
    const value = { project, revisions };
    let alive = true;
    const save = () =>
      persist(value)
        .then(() => {
          if (alive && valueRef.current.project === project) {
            setStatus("Saved on this device");
            setError("");
          }
        })
        .catch((e) => {
          if (alive) {
            setStatus("Save failed — export a backup");
            setError(e.message);
          }
        });
    const t = setTimeout(save, 400);
    const hidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      alive = false;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [project, revisions, loading, scope]);
  useEffect(
    () => () => {
      if (loadedRef.current) persist(valueRef.current).catch(() => {});
    },
    [scope],
  );
  const commit = (update: Project | ((p: Project) => Project)) => {
    setHistory((previous) => {
      const current = previous.items[previous.index];
      const next = projectSchema.parse({
        ...(typeof update === "function" ? update(current) : update),
        updatedAt: Date.now(),
      });
      const items = [
        ...previous.items.slice(0, previous.index + 1),
        next,
      ].slice(-50);
      return { items, index: items.length - 1 };
    });
  };
  const refresh = async () => {
    try {
      await persist(valueRef.current);
      const items = await listProjects(scope);
      setLibrary(items);
      return items;
    } catch (e: any) {
      setError(e.message);
      return [];
    }
  };
  const openProject = async (value: SavedProject) => {
    await persist(valueRef.current);
    await persist(value);
    setHistory({ items: [value.project], index: 0 });
    setRevisions(value.revisions);
    try {
      localStorage.setItem(`aura-active-project:${scope}`, value.project.id);
    } catch {}
    setError("");
  };
  const newProject = async (kind: Project["garment"]) => {
    await persist(valueRef.current);
    const next = createProject(kind);
    await persist({ project: next, revisions: [] });
    setHistory({ items: [next], index: 0 });
    setRevisions([]);
    try {
      localStorage.setItem(`aura-active-project:${scope}`, next.id);
    } catch {}
    return next;
  };
  const saveVersion = async (label: string) => {
    const snapshot = {
      id: crypto.randomUUID(),
      label: label.trim().slice(0, 60) || `Version ${revisions.length + 1}`,
      createdAt: Date.now(),
      project,
    };
    const next = [...revisions, snapshot].slice(-20);
    await persist({ project, revisions: next });
    setRevisions(next);
    setStatus("Version saved on this device");
  };
  return {
    project,
    commit,
    revisions,
    library,
    loading,
    status,
    error,
    setError,
    refresh,
    openProject,
    newProject,
    saveVersion,
    saveNow: () => persist(valueRef.current),
    canUndo: history.index > 0,
    canRedo: history.index < history.items.length - 1,
    undo: () => setHistory((h) => ({ ...h, index: Math.max(0, h.index - 1) })),
    redo: () =>
      setHistory((h) => ({
        ...h,
        index: Math.min(h.items.length - 1, h.index + 1),
      })),
  };
}
