import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DRESS_LOOKS, dressPrompt } from "../../shared/lookLibrary";
import { auth } from "../firebase";
import { api, readImage } from "../services/api";

type Task = {
  id: string;
  kind: string;
  status: string;
  progress?: number;
  hasModel?: boolean;
  createdAt?: number;
};
export default function MeshyPanel({
  onModel,
}: {
  onModel: (file: File) => Promise<boolean>;
}) {
  const [config, setConfig] = useState<{
    ready: boolean;
    retextureReady: boolean;
    maxTaskCredits: number;
  } | null>(null);
  const [params] = useSearchParams();
  const initialLook = DRESS_LOOKS.find(
    (look) => look.id === params.get("look"),
  );
  const [kind, setKind] = useState(initialLook ? "text" : "image");
  const [sourceId, setSourceId] = useState("");
  const [prompt, setPrompt] = useState(
    initialLook ? dressPrompt(initialLook) : "",
  );
  const [reference, setReference] = useState("");
  const [consent, setConsent] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);
  const uid = auth.currentUser?.uid;
  useEffect(() => {
    let alive = true;
    if (uid) {
      api("/modeling/config")
        .then((value) => {
          if (alive) setConfig(value);
        })
        .catch((error) => {
          if (alive) setMessage(error.message);
        });
      api("/modeling/tasks")
        .then((value) => {
          if (alive) setHistory(value);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [uid]);
  // Polling only reads the existing provider task; it never creates another charge.
  useEffect(() => {
    if (
      !task ||
      !["PENDING", "IN_PROGRESS", "SUBMITTING"].includes(task.status)
    )
      return;
    let alive = true;
    const timer = setTimeout(() => {
      api<Task>(`/modeling/tasks/${task.id}`)
        .then((value) => {
          if (alive) {
            setTask(value);
            setMessage("");
          }
        })
        .catch((error) => {
          if (alive)
            setMessage(`${error.message} Use Check progress to retry.`);
        });
    }, 7000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [task]);
  const refresh = async (id: string) => {
    const next = await api<Task>(`/modeling/tasks/${id}`);
    setTask(next);
  };
  const action = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };
  const submit = () =>
    action(async () => {
      requestId.current ||= crypto.randomUUID();
      const result = await api<{ id: string }>("/modeling/tasks", {
        requestId: requestId.current,
        kind,
        consent,
        ...(kind === "image"
          ? { image: reference }
          : kind === "retexture"
            ? { sourceId, ...(reference ? { image: reference } : { prompt }) }
            : { prompt }),
      });
      await refresh(result.id);
      requestId.current = null;
      setHistory(await api("/modeling/tasks"));
    });
  const load = () =>
    action(async () => {
      if (!task) return;
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/modeling/tasks/${task.id}/model`, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      if (!response.ok) {
        const value = await response.json();
        throw new Error(value.error || "Model download failed.");
      }
      const blob = await response.blob();
      const loaded = await onModel(
        new File([blob], `aura-${task.id}.glb`, { type: "model/gltf-binary" }),
      );
      if (!loaded)
        throw new Error(
          "The model could not be opened. See the viewer message below.",
        );
    });
  return (
    <div className="meshy-panel">
      <h2>Generate with Meshy</h2>
      <p>
        {config?.ready
          ? `Approved pilot account · ${config.maxTaskCredits} credits reserved per task.`
          : "Generation needs a Meshy API key, approved account and credit limits configured on the server."}
      </p>
      {!uid && <Link to="/login">Log in to generate</Link>}
      <label>
        Dress inspiration
        <select
          aria-label="Dress inspiration"
          disabled={busy}
          defaultValue={initialLook?.id || ""}
          onChange={(e) => {
            const look = DRESS_LOOKS.find((l) => l.id === e.target.value);
            if (look) {
              setPrompt(dressPrompt(look));
              setReference("");
              if (kind !== "retexture") setKind("text");
            }
          }}
        >
          <option value="">Choose one of 18 designs</option>
          {DRESS_LOOKS.map((look) => (
            <option value={look.id} key={look.id}>
              {look.name}
            </option>
          ))}
        </select>
      </label>
      <Link to="/looks">Browse all editable dresses →</Link>
      <label>
        Input method
        <select
          disabled={busy}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="image">Image to textured 3D</option>
          <option value="text">Text to 3D shape</option>
          <option value="retexture">Apply a design to a generated model</option>
        </select>
      </label>
      {kind === "retexture" && (
        <label>
          Completed source model
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="">Select a completed task</option>
            {history
              .filter((job) => job.status === "SUCCEEDED")
              .map((job) => (
                <option key={job.id} value={job.id}>
                  {new Date(job.createdAt || 0).toLocaleString()} · {job.kind}
                </option>
              ))}
          </select>
          <small>
            Preserves the existing model's shape. Meshy generates new surface
            textures; review placement before using the result.
          </small>
        </label>
      )}
      {kind === "image" || kind === "retexture" ? (
        <>
          <label htmlFor="meshy-reference">
            Reference image · PNG, JPEG or WebP
          </label>
          <input
            id="meshy-reference"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void action(async () => {
                  const image = await readImage(file);
                  const decoded = new Image();
                  decoded.src = image;
                  await decoded.decode();
                  if (decoded.width < 32 || decoded.height < 32)
                    throw new Error(
                      "Meshy needs an image at least 32 pixels on each side.",
                    );
                  setReference(image);
                });
              e.target.value = "";
            }}
          />
          {reference && (
            <>
              <img src={reference} alt="Reference to send to Meshy" />
              <button disabled={busy} onClick={() => setReference("")}>
                Remove reference
              </button>
            </>
          )}
        </>
      ) : (
        <label>
          Describe your 3D model
          <textarea
            disabled={busy}
            value={prompt}
            maxLength={800}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Full-length bridal outfit on a female avatar, relaxed standing pose…"
          />
          <small>
            Generate the shape first, then apply a design to add textures.
          </small>
        </label>
      )}
      {kind === "retexture" && (
        <label>
          Describe the fabric and embroidery
          <textarea
            maxLength={800}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <small>
            {reference
              ? "The uploaded style reference will be used. Remove it to use this description."
              : "Describe motifs, colors, trim placement and the appearance you want."}
          </small>
        </label>
      )}
      <label>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        I have permission to use this content and agree to send it to Meshy,
        consuming the configured provider credits.
      </label>
      <button
        className="primary"
        disabled={
          busy ||
          !config?.ready ||
          !consent ||
          (kind === "image"
            ? !reference
            : kind === "retexture"
              ? !sourceId ||
                !config?.retextureReady ||
                (!reference && prompt.trim().length < 3)
              : prompt.trim().length < 3)
        }
        onClick={() => void submit()}
      >
        Generate with Meshy
      </button>
      <p>
        Sponsored pilot: at most three tasks per approved account per day. This
        uses the application's Meshy credits; customer billing is not enabled.
      </p>
      {message && <p role="alert">{message}</p>}
      {task && (
        <div className="meshy-task">
          <p role="status">
            {task.status}
            {typeof task.progress === "number" &&
            ["PENDING", "IN_PROGRESS", "SUCCEEDED"].includes(task.status)
              ? ` · ${task.progress}%`
              : ""}
          </p>
          {task.status === "SUBMISSION_UNKNOWN" && (
            <p>
              The provider may have accepted this task. Check the Meshy
              dashboard before starting another task.
            </p>
          )}
          <button
            disabled={busy}
            onClick={() => void action(() => refresh(task.id))}
          >
            Check progress
          </button>
          {task.hasModel && (
            <>
              <button disabled={busy} onClick={() => void load()}>
                Load generated model
              </button>
              <button
                disabled={busy || !config?.retextureReady}
                onClick={() => {
                  setSourceId(task.id);
                  setKind("retexture");
                  setReference("");
                  void api<Task[]>("/modeling/tasks")
                    .then(setHistory)
                    .catch((error) => setMessage(error.message));
                }}
              >
                Apply a fabric design
              </button>
            </>
          )}
        </div>
      )}
      {history.length > 0 && (
        <label>
          Recent tasks
          <select
            disabled={busy}
            value={task?.id || ""}
            onChange={(e) => {
              if (e.target.value) void action(() => refresh(e.target.value));
            }}
          >
            <option value="">Select a task</option>
            {history.map((job) => (
              <option value={job.id} key={job.id}>
                {new Date(job.createdAt || 0).toLocaleString()} · {job.kind}
              </option>
            ))}
          </select>
        </label>
      )}
      <a href="https://www.meshy.ai/workspace" target="_blank" rel="noreferrer">
        Meshy dashboard ↗
      </a>
    </div>
  );
}
