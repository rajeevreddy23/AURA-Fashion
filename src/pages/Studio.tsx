import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Design,
  Layer,
  blankDesign,
  designSchema,
  historyPush,
  templates,
  templatePath,
} from "../../shared/studio";
import { LayerArt, download, pngImage, svgText } from "../components/DesignArt";
import {
  api,
  checkout,
  money,
  readImage,
  useConfiguration,
} from "../services/api";
import { resizeBase64Image } from "../services/geminiService";
import { auth } from "../firebase";
const Preview3D = lazy(() => import("../components/Preview3D"));
type Tool = "select" | "pen" | "eraser" | "line" | "rect" | "circle";
const clamp = (v: number, min = 0, max = 600) =>
  Math.min(max, Math.max(min, v));
export default function Studio() {
  const key = `aura-design-v1:${auth.currentUser?.uid || "guest"}`;
  const load = () => {
    try {
      return designSchema.parse(
        JSON.parse(localStorage.getItem(key) || "null"),
      );
    } catch {
      return blankDesign();
    }
  };
  const [timeline, setTimeline] = useState<Design[]>(() => [load()]);
  const [index, setIndex] = useState(0);
  const design = timeline[index];
  const [draft, setDraft] = useState<Design | null>(null);
  const shown = draft || design;
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#39304d");
  const [stroke, setStroke] = useState(4);
  const [advanced, setAdvanced] = useState(false);
  const [grid, setGrid] = useState(true);
  const [preview, setPreview] = useState(true);
  const [saved, setSaved] = useState("Saved on this device");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [rights, setRights] = useState(false);
  const [gender, setGender] = useState<"men" | "women">("women");
  const [entitlement, setEntitlement] = useState<any>(null);
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<any>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);
  const publishId = useRef(crypto.randomUUID());
  const config = useConfiguration();
  const [params] = useSearchParams();
  const commit = (next: Design) => {
    setTimeline((prev) => historyPush(prev, index, next));
    setIndex(Math.min(index + 1, 49));
    setDraft(null);
  };
  const undo = () => {
    setIndex((i) => Math.max(0, i - 1));
    setDraft(null);
    setSelected(null);
  };
  const redo = () => {
    setIndex((i) => Math.min(timeline.length - 1, i + 1));
    setDraft(null);
    setSelected(null);
  };
  useEffect(() => {
    setSaved("Saving…");
    const save = () => {
      try {
        localStorage.setItem(key, JSON.stringify(design));
        setSaved("Saved on this device");
      } catch {
        setSaved(
          "Storage is full or unavailable. Export your design to keep it.",
        );
      }
    };
    const t = setTimeout(save, 300);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pagehide", save);
      try {
        localStorage.setItem(key, JSON.stringify(design));
      } catch {}
    };
  }, [design, key]);
  useEffect(() => {
    if (auth.currentUser && config.communityReady)
      api("/me")
        .then(setEntitlement)
        .catch(() => {});
  }, [config.communityReady]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [timeline, index]);
  const layer = design.layers.find((l) => l.id === selected);
  const point = (e: { clientX: number; clientY: number }) => {
    const rect = svg.current!.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - rect.left) * 600) / rect.width),
      y: clamp(((e.clientY - rect.top) * 600) / rect.height),
    };
  };
  const add = (
    kind: Layer["kind"],
    x = 260,
    y = 260,
    text?: Layer["text"],
    image?: string,
  ) => {
    if (design.layers.length >= 100) {
      setMessage("This design has 100 layers. Remove a layer to add another.");
      return;
    }
    const l: Layer = {
      id: crypto.randomUUID(),
      kind,
      x: clamp(x, 0, 500),
      y: clamp(y, 0, 500),
      width: 100,
      height: 100,
      color,
      stroke,
      ...(text ? { text } : {}),
      ...(image ? { image } : {}),
    };
    commit({ ...design, layers: [...design.layers, l] });
    setSelected(l.id);
    setTool("select");
  };
  const start = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!e.isPrimary || e.button !== 0) return;
    const p = point(e);
    const target = (e.target as Element)
      .closest("[data-layer]")
      ?.getAttribute("data-layer");
    svg.current?.setPointerCapture(e.pointerId);
    if (tool === "select") {
      setSelected(target || null);
      if (target)
        gesture.current = { kind: "move", start: p, base: design, id: target };
      return;
    }
    if (tool === "eraser") {
      if (target) {
        commit({
          ...design,
          layers: design.layers.filter((l) => l.id !== target),
        });
        setSelected(null);
      }
      return;
    }
    if (design.layers.length >= 100) return;
    const id = crypto.randomUUID();
    const l: Layer = {
      id,
      kind: tool,
      x: p.x,
      y: p.y,
      width: 1,
      height: 1,
      color,
      stroke,
      ...(tool === "pen"
        ? { points: [p, { x: clamp(p.x + 0.01), y: p.y }] }
        : {}),
    };
    gesture.current = { kind: "draw", start: p, base: design, layer: l };
    setDraft({ ...design, layers: [...design.layers, l] });
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g) return;
    const p = point(e);
    if (g.kind === "move") {
      const original = g.base.layers.find((l: Layer) => l.id === g.id);
      let dx = p.x - g.start.x,
        dy = p.y - g.start.y;
      if (original.points) {
        const xs = original.points.map((q: any) => q.x),
          ys = original.points.map((q: any) => q.y);
        dx = clamp(dx, -Math.min(...xs), 600 - Math.max(...xs));
        dy = clamp(dy, -Math.min(...ys), 600 - Math.max(...ys));
      } else {
        dx = clamp(dx, -original.x, 600 - original.x - original.width);
        dy = clamp(dy, -original.y, 600 - original.y - original.height);
      }
      setDraft({
        ...g.base,
        layers: g.base.layers.map((l: Layer) =>
          l.id === g.id
            ? {
                ...l,
                x: l.x + dx,
                y: l.y + dy,
                ...(l.points
                  ? {
                      points: l.points.map((q) => ({
                        x: q.x + dx,
                        y: q.y + dy,
                      })),
                    }
                  : {}),
              }
            : l,
        ),
      });
    } else {
      const l = g.layer as Layer;
      if (l.kind === "pen") {
        if ((l.points?.length || 0) < 3000) l.points = [...(l.points || []), p];
      } else {
        l.x = Math.min(g.start.x, p.x);
        l.y = Math.min(g.start.y, p.y);
        l.width = Math.max(1, Math.abs(p.x - g.start.x));
        l.height = Math.max(1, Math.abs(p.y - g.start.y));
      }
      setDraft({ ...g.base, layers: [...g.base.layers, { ...l }] });
    }
  };
  const finish = (cancel = false) => {
    if (!gesture.current) return;
    gesture.current = null;
    if (!cancel && draft) commit(draft);
    else setDraft(null);
  };
  const patchLayer = (changes: Partial<Layer>) => {
    if (!layer) return;
    commit({
      ...design,
      layers: design.layers.map((l) =>
        l.id === layer.id ? { ...l, ...changes } : l,
      ),
    });
  };
  const keyboardMove = (e: React.KeyboardEvent) => {
    if (
      !layer ||
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Delete",
        "Backspace",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    if (["Delete", "Backspace"].includes(e.key)) {
      commit({
        ...design,
        layers: design.layers.filter((l) => l.id !== layer.id),
      });
      setSelected(null);
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const dx =
        e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
      dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    if (layer.points) {
      const points = layer.points.map((p) => ({
        x: clamp(p.x + dx),
        y: clamp(p.y + dy),
      }));
      patchLayer({ points });
    } else
      patchLayer({
        x: clamp(layer.x + dx, 0, 600 - layer.width),
        y: clamp(layer.y + dy, 0, 600 - layer.height),
      });
  };
  const imageUpload = async (file?: File) => {
    if (!file) return;
    try {
      const data = await resizeBase64Image(await readImage(file), 600, 0.8);
      if (data.length > 450000)
        throw new Error("This image is too detailed. Choose a smaller one.");
      add("image", 180, 180, undefined, data);
    } catch (e: any) {
      setMessage(e.message);
    }
  };
  const exportPng = async () => {
    try {
      const data = await pngImage(design);
      const a = document.createElement("a");
      a.href = data;
      a.download = "aura-design.png";
      a.click();
    } catch (e: any) {
      setMessage(e.message);
    }
  };
  const publish = async () => {
    setBusy(true);
    try {
      const result = await api("/designs", {
        requestId: publishId.current,
        design,
        image: await pngImage(design),
        rights,
        gender,
      });
      publishId.current = crypto.randomUUID();
      setMessage(
        `Published successfully. View your design in Shop (ID: ${result.id}).`,
      );
      setEntitlement(await api("/me"));
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  const buy = async (kind: "render" | "publish") => {
    setBusy(true);
    try {
      if (kind === "render")
        sessionStorage.removeItem(
          "aura-classic-render:" + auth.currentUser?.uid,
        );
      await checkout(kind);
    } catch (e: any) {
      setMessage(e.message);
      setBusy(false);
    }
  };
  return (
    <div className="studio-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">AURA STUDIO</p>
          <Link className="text-link" to="/studio">
            Open advanced pattern & 3D workspace →
          </Link>
          <h2>Make it yours.</h2>
          <p className="muted">
            Start with a garment. Add details. Explore more tools when you’re
            ready.
          </p>
        </div>
        <Link className="text-link" to="/shopping">
          Explore designs →
        </Link>
      </div>
      <div className="studio-title">
        <label className="field">
          Design name
          <input
            maxLength={80}
            value={design.name}
            onChange={(e) => commit({ ...design, name: e.target.value })}
          />
        </label>
        <p role="status" className="save-status">
          {saved}
        </p>
      </div>
      {message && (
        <p role="alert" className="notice">
          {message}
        </p>
      )}
      {params.get("renderOrder") && (
        <p className="notice">
          Your render payment is ready.{" "}
          <Link to={`/payment?order=${params.get("renderOrder")}`}>
            Continue to your order
          </Link>
          .
        </p>
      )}
      <div className="studio-layout">
        <aside className="panel studio-palette">
          <h3>1. Choose a base</h3>
          <div className="base-options">
            {Object.entries(templates).map(([id, t]) => (
              <button
                key={id}
                className="choice"
                aria-pressed={design.template === id}
                onClick={() =>
                  commit({ ...design, template: id as Design["template"] })
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="field">
            Fabric color
            <input
              aria-label="Fabric color"
              type="color"
              value={design.fabric}
              onChange={(e) => commit({ ...design, fabric: e.target.value })}
            />
          </label>
          <h3>2. Add a detail</h3>
          <p className="muted">Tap to add, or drag onto the drawing.</p>
          <div className="part-options">
            {(["✿", "★", "♥", "◆", "🎀", "🦋"] as const).map((text) => (
              <button
                className="part"
                key={text}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", text)}
                aria-label={`Add ${text}`}
                onClick={() => add("sticker", 260, 260, text)}
              >
                {text}
              </button>
            ))}
          </div>
          <button
            className="secondary"
            onClick={() => fileInput.current?.click()}
          >
            Import image
          </button>
          <input
            ref={fileInput}
            aria-label="Import a design image"
            className="sr-only"
            tabIndex={-1}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              imageUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            className="text-link"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
          >
            {advanced ? "− Fewer tools" : "+ Advanced tools"}
          </button>
          {advanced && (
            <div className="advanced-tools">
              <label className="field">
                Line color
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
              <label className="field">
                Line width
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={stroke}
                  onChange={(e) => setStroke(+e.target.value)}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={grid}
                  onChange={(e) => setGrid(e.target.checked)}
                />
                Show grid
              </label>
              <button
                className="secondary"
                onClick={() => jsonInput.current?.click()}
              >
                Open design file
              </button>
              <button
                className="secondary"
                onClick={() =>
                  download(
                    "aura-design.json",
                    JSON.stringify(design),
                    "application/json",
                  )
                }
              >
                Save design file
              </button>
              <button
                className="secondary"
                onClick={() =>
                  download("aura-design.svg", svgText(design), "image/svg+xml")
                }
              >
                Export SVG
              </button>
              <button
                className="secondary"
                onClick={() => {
                  commit({ ...design, layers: [] });
                  setSelected(null);
                }}
              >
                Clear details
              </button>
            </div>
          )}
        </aside>
        <section className="panel drawing-panel">
          <div className="toolbar" aria-label="Drawing tools">
            {(
              [
                "select",
                "pen",
                "eraser",
                ...(advanced ? ["line", "rect", "circle"] : []),
              ] as Tool[]
            ).map((t) => (
              <button
                key={t}
                aria-pressed={tool === t}
                onClick={() => {
                  setTool(t);
                  setSelected(null);
                }}
              >
                {t === "rect" ? "Rectangle" : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
            <button aria-label="Undo" disabled={index === 0} onClick={undo}>
              ↶ Undo
            </button>
            <button
              aria-label="Redo"
              disabled={index === timeline.length - 1}
              onClick={redo}
            >
              ↷ Redo
            </button>
          </div>
          <svg
            ref={svg}
            className="drawing-surface"
            data-testid="drawing-surface"
            role="img"
            aria-label="2D garment editor. Use Select to move a detail; arrow keys move the selected layer."
            tabIndex={0}
            viewBox="0 0 600 600"
            onKeyDown={keyboardMove}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={() => finish()}
            onPointerCancel={() => finish(true)}
            onLostPointerCapture={() => finish()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const text = e.dataTransfer.getData("text/plain");
              const p = point(e);
              if (["✿", "★", "♥", "◆", "🎀", "🦋"].includes(text))
                add("sticker", p.x - 50, p.y - 50, text as Layer["text"]);
              else if (e.dataTransfer.files[0])
                imageUpload(e.dataTransfer.files[0]);
            }}
          >
            <defs>
              <pattern
                id="studio-grid"
                width="25"
                height="25"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M25 0H0V25"
                  fill="none"
                  stroke="#e9e4f1"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect
              width="600"
              height="600"
              fill={grid ? "url(#studio-grid)" : "white"}
            />
            <path
              d={templatePath(shown.template)}
              fill={shown.fabric}
              stroke="#524365"
              strokeWidth="2"
            />
            {shown.layers.map((l) => (
              <g
                key={l.id}
                data-layer={l.id}
                style={{ cursor: tool === "select" ? "move" : undefined }}
              >
                {l.kind !== "pen" && (
                  <rect
                    x={l.x}
                    y={l.y}
                    width={l.width}
                    height={l.height}
                    fill="transparent"
                    pointerEvents="all"
                  />
                )}
                <LayerArt layer={l} />
                {selected === l.id && l.kind !== "pen" && (
                  <rect
                    x={l.x - 5}
                    y={l.y - 5}
                    width={l.width + 10}
                    height={l.height + 10}
                    fill="none"
                    stroke="#6941c6"
                    strokeDasharray="5 4"
                    pointerEvents="none"
                  />
                )}
              </g>
            ))}
          </svg>
          <p className="muted canvas-help">
            Select a detail to move it. Touch, mouse and pen work here. Scroll
            outside the drawing.
          </p>
          {layer && (
            <div className="layer-controls">
              <h3>Selected {layer.kind}</h3>
              {layer.kind !== "pen" && (
                <>
                  <label className="field">
                    Width
                    <input
                      type="number"
                      min="1"
                      max={600 - layer.x}
                      value={layer.width}
                      onChange={(e) =>
                        patchLayer({
                          width: clamp(+e.target.value, 1, 600 - layer.x),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    Height
                    <input
                      type="number"
                      min="1"
                      max={600 - layer.y}
                      value={layer.height}
                      onChange={(e) =>
                        patchLayer({
                          height: clamp(+e.target.value, 1, 600 - layer.y),
                        })
                      }
                    />
                  </label>
                </>
              )}
              <label className="field">
                Detail color
                <input
                  type="color"
                  value={layer.color}
                  onChange={(e) => patchLayer({ color: e.target.value })}
                />
              </label>
              <button
                className="secondary"
                onClick={() => {
                  if (design.layers.length >= 100) return;
                  const copy = { ...layer, id: crypto.randomUUID() };
                  commit({ ...design, layers: [...design.layers, copy] });
                  setSelected(copy.id);
                }}
              >
                Duplicate
              </button>
              <button
                className="secondary"
                onClick={() =>
                  commit({
                    ...design,
                    layers: [
                      ...design.layers.filter((l) => l.id !== layer.id),
                      layer,
                    ],
                  })
                }
              >
                Bring to front
              </button>
              <button
                className="secondary"
                onClick={() => {
                  commit({
                    ...design,
                    layers: design.layers.filter((l) => l.id !== layer.id),
                  });
                  setSelected(null);
                }}
              >
                Remove detail
              </button>
            </div>
          )}
          {advanced && design.layers.length > 0 && (
            <label className="field">
              Layers
              <select
                aria-label="Select layer"
                value={selected || ""}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setTool("select");
                }}
              >
                <option value="">Choose a detail</option>
                {design.layers.map((l, i) => (
                  <option key={l.id} value={l.id}>
                    {i + 1}. {l.kind} {l.text || ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="button-row">
            <button className="primary" onClick={exportPng}>
              Download PNG
            </button>
            <button
              className="secondary"
              aria-expanded={preview}
              onClick={() => setPreview((v) => !v)}
            >
              {preview ? "Hide 3D" : "Show 3D"}
            </button>
          </div>
        </section>
        {preview && (
          <aside className="panel preview-panel">
            <h3>3. Preview your concept</h3>
            <Suspense fallback={<p>Loading preview…</p>}>
              <Preview3D design={shown} />
            </Suspense>
          </aside>
        )}
      </div>
      <section className="panel publish-panel">
        <div>
          <p className="eyebrow">READY TO SHARE?</p>
          <h3>Publish your design</h3>
          <p className="muted">
            Keep creating for free. Publishing uses one paid upload or one
            upload from your 30-day pass. Try-ons are paid separately.
          </p>
          {entitlement && (
            <p>
              {entitlement.publishCredits} upload credits ·{" "}
              {entitlement.pass
                ? `${entitlement.pass.remaining} pass uploads left`
                : "No active publishing pass"}
            </p>
          )}
        </div>
        <div className="publish-actions">
          <label className="field">
            Collection
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as any)}
            >
              <option value="women">Women</option>
              <option value="men">Men</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={rights}
              onChange={(e) => setRights(e.target.checked)}
            />
            I own this design and may publish it.
          </label>
          <button
            className="primary"
            disabled={busy || !rights || !config.publishingReady}
            onClick={publish}
          >
            {busy ? "Please wait…" : "Publish using my entitlement"}
          </button>
          <button
            className="secondary"
            disabled={busy || !config.publishingReady}
            onClick={() => buy("publish")}
          >
            Buy one upload · {money(config.publishPrice)}
          </button>
          <Link className="text-link" to="/subscription">
            View publishing pass
          </Link>
          {!config.publishingReady && (
            <p className="muted">
              Publishing payments are awaiting setup. You can save and export
              your work now.
            </p>
          )}
        </div>
      </section>
      <section className="panel">
        <h3>AI design render</h3>
        <p className="muted">
          A paid image render of your sketch. Your saved design will be
          available after payment.
        </p>
        <button
          className="secondary"
          disabled={busy || !config.tryOnReady}
          onClick={() => buy("render")}
        >
          Pay for one render · {money(config.tryOnPrice)}
        </button>
        <p className="muted">
          For the original raster drawing tools,{" "}
          <Link to="/sketch/classic">open the classic sketcher</Link>. AI
          actions use the paid order flow.
        </p>
      </section>
      <input
        ref={jsonInput}
        aria-label="Open an AURA design file"
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="application/json,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 700000)
              throw new Error("Design file is too large.");
            const next = designSchema.parse(JSON.parse(await file.text()));
            commit(next);
            setSelected(null);
            setMessage("Design opened. Undo restores your previous design.");
          } catch {
            setMessage("This is not a supported AURA design file.");
          }
        }}
      />
    </div>
  );
}
