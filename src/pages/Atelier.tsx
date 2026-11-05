import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Box,
  Columns2,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Lock,
  Unlock,
  Palette,
  Play,
  Pause,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  Scissors,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import {
  Project,
  Piece,
  Material,
  Trim,
  createProject,
  exportCostCsv,
  exportPatternSvg,
  fitReadings,
  materialCost,
  newId,
  parseProject,
  designChecks,
  applyMeasurementEase,
} from "../../shared/workspace";
import { auth } from "../firebase";
import { api, checkout, money, useConfiguration } from "../services/api";
import { processSketch } from "../services/geminiService";
import { download } from "../components/DesignArt";
import { useWorkspace } from "../studio/useWorkspace";
import PatternViewport from "../studio/PatternViewport";
import TechPack from "../studio/TechPack";
import type { ViewportApi } from "../studio/GarmentViewport";
import "../studio/atelier.css";
const GarmentViewport = lazy(() => import("../studio/GarmentViewport"));
type Panel =
  | "components"
  | "measurements"
  | "materials"
  | "trims"
  | "simulation"
  | "costing"
  | "versions"
  | "projects"
  | "techpack"
  | "assistant";
const sections: { id: Panel; label: string; icon: any }[] = [
  { id: "components", label: "Components", icon: Layers },
  { id: "measurements", label: "Measurements", icon: Ruler },
  { id: "materials", label: "Fabrics", icon: Palette },
  { id: "trims", label: "Trims & details", icon: Scissors },
  { id: "simulation", label: "Cloth preview", icon: Settings2 },
  { id: "costing", label: "Costing & BOM", icon: Box },
  { id: "versions", label: "Versions", icon: Save },
  { id: "projects", label: "My designs", icon: FolderOpen },
  { id: "techpack", label: "Tech pack", icon: Download },
  { id: "assistant", label: "AI & services", icon: Sparkles },
];
const kinds: { id: Piece["kind"]; label: string }[] = [
  { id: "bodice-front", label: "Blouse front" },
  { id: "bodice-back", label: "Blouse back" },
  { id: "skirt", label: "Skirt panel" },
  { id: "sleeve", label: "Sleeves" },
  { id: "dupatta", label: "Dupatta" },
  { id: "waistband", label: "Waistband" },
  { id: "lining", label: "Lining panel" },
];
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = "",
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <label className="atelier-field">
      <span>
        {label}
        {suffix && <small>{suffix}</small>}
      </span>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(3))}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === "") return;
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
      />
    </label>
  );
}
function RangeField({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="atelier-range">
      <span>
        {label}
        <output>{value.toFixed(step >= 1 ? 0 : 2)}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
}
export default function Atelier() {
  const scope = auth.currentUser?.uid || "guest";
  const workspace = useWorkspace(scope);
  const { project, commit } = workspace;
  const [panel, setPanel] = useState<Panel>("materials");
  const [view, setView] = useState<"split" | "3d" | "2d">(() =>
    matchMedia("(max-width: 1000px)").matches ? "3d" : "split",
  );
  const [selected, setSelected] = useState("");
  const [running, setRunning] = useState(false);
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [versionLabel, setVersionLabel] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [addKind, setAddKind] = useState<Piece["kind"]>("skirt");
  const [trimKind, setTrimKind] = useState<Trim["kind"]>("border");
  const [template, setTemplate] = useState<Project["garment"]>("lehenga");
  const [easeCm, setEaseCm] = useState(6);
  const [mobileInspector, setMobileInspector] = useState(false);
  const [rights, setRights] = useState(false),
    [dataConsent, setDataConsent] = useState(false),
    [publicationAccess, setPublicationAccess] = useState<"approval" | "public">(
      "approval",
    ),
    [entitlement, setEntitlement] = useState<any>(null);
  const publishId = useRef(newId()),
    loadedShared = useRef("");
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedDesign = searchParams.get("design");
  const apiRef = useRef<ViewportApi | null>(null),
    importRef = useRef<HTMLInputElement>(null),
    nameRef = useRef<HTMLInputElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const config = useConfiguration();
  const piece =
      project.pieces.find((p) => p.id === selected) || project.pieces[0],
    material = project.materials.find((m) => m.id === piece.materialId)!;
  const cost = materialCost(project);
  useEffect(() => {
    if (!project.pieces.some((p) => p.id === selected))
      setSelected(project.pieces[0].id);
  }, [project.id, project.pieces, selected]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.target as Element).closest("input,textarea,select,[contenteditable]")
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? workspace.redo() : workspace.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        workspace
          .saveNow()
          .then(() => setMessage("Project saved on this device."))
          .catch((e) => setMessage(e.message));
      }
    };
    addEventListener("keydown", listener);
    return () => removeEventListener("keydown", listener);
  }, [workspace]);
  const notify = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (e: any) {
      setMessage(
        e.message ||
          "The action could not be completed. Your current design is still open.",
      );
    } finally {
      setBusy(false);
    }
  };
  const patchPiece = (changes: Partial<Piece>) => {
    if (piece.locked) {
      setMessage("Unlock this component before editing it.");
      return;
    }
    commit((p) => ({
      ...p,
      pieces: p.pieces.map((x) =>
        x.id === piece.id ? { ...x, ...changes } : x,
      ),
    }));
  };
  useEffect(() => {
    publishId.current = newId();
    setRights(false);
    setDataConsent(false);
  }, [project.id]);
  useEffect(() => {
    if (auth.currentUser && config.communityReady)
      api("/me")
        .then(setEntitlement)
        .catch((e) => setMessage(e.message));
  }, [config.communityReady, scope]);
  useEffect(() => {
    if (
      workspace.loading ||
      !sharedDesign ||
      loadedShared.current === sharedDesign
    )
      return;
    if (!auth.currentUser) {
      setMessage(
        "Log in to open this shared project. Your local workspace is still available.",
      );
      return;
    }
    loadedShared.current = sharedDesign;
    notify(async () => {
      const imported = parseProject(
        JSON.stringify(await api(`/designs/${sharedDesign}/project`)),
      );
      await workspace.openProject({
        project: { ...imported, id: newId(), updatedAt: Date.now() },
        revisions: [],
      });
      setMessage(
        "Shared project opened as a local copy. Respect the designer’s permission terms.",
      );
    });
  }, [workspace.loading, sharedDesign, scope]);
  const previewPng = async () => {
    if (!apiRef.current)
      throw new Error("Open the 3D view before publishing or rendering.");
    const img = new Image();
    img.src = apiRef.current.snapshot();
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("Image export is not supported on this device.");
    c.fillStyle = "#f5f6ef";
    c.fillRect(0, 0, 600, 600);
    const ratio = Math.min(600 / img.width, 600 / img.height);
    c.drawImage(
      img,
      (600 - img.width * ratio) / 2,
      (600 - img.height * ratio) / 2,
      img.width * ratio,
      img.height * ratio,
    );
    return canvas.toDataURL("image/png");
  };
  const publishProject = () =>
    notify(async () => {
      const result = await api("/designs", {
        requestId: publishId.current,
        design: project,
        image: await previewPng(),
        rights,
        dataConsent,
        patternAccess: publicationAccess,
        gender: "women",
      });
      publishId.current = newId();
      setRights(false);
      setDataConsent(false);
      setEntitlement(await api("/me"));
      setMessage(
        `Project published. Manage it in My uploads. Reference: ${result.id}`,
      );
    });
  const patchMaterial = (changes: Partial<Material>) =>
    commit((p) => ({
      ...p,
      materials: p.materials.map((m) =>
        m.id === material.id ? { ...m, ...changes } : m,
      ),
    }));
  const addPiece = () => {
    if (project.pieces.length >= 40) {
      setMessage("A project can contain up to 40 components.");
      return;
    }
    const base =
      createProject().pieces.find((p) => p.kind === addKind) ||
      createProject().pieces[3];
    const next: Piece = {
      ...base,
      id: newId(),
      kind: addKind,
      name: kinds.find((k) => k.id === addKind)!.label,
      materialId: material.id,
      x: Math.min(700, 12 + project.pieces.length * 10),
      y: Math.min(700, 12 + project.pieces.length * 8),
    };
    commit((p) => ({ ...p, pieces: [...p.pieces, next] }));
    setSelected(next.id);
    setPanel("components");
  };
  const removePiece = () => {
    if (piece.locked || project.pieces.length <= 1) return;
    commit((p) => ({
      ...p,
      pieces: p.pieces.filter((x) => x.id !== piece.id),
      trims: p.trims.filter((t) => t.pieceId !== piece.id),
    }));
  };
  const addTrim = () => {
    if (piece.locked) {
      setMessage("Unlock the component before adding details.");
      return;
    }
    if (project.trims.length >= 100) {
      setMessage("A project can contain up to 100 trims.");
      return;
    }
    const t: Trim = {
      id: newId(),
      name:
        trimKind === "border"
          ? "Decorative border"
          : trimKind === "embroidery"
            ? "Embroidered motifs"
            : trimKind === "buttons"
              ? "Button row"
              : "Tassel detail",
      kind: trimKind,
      pieceId: piece.id,
      color: "#d7af5c",
      position: 0.85,
      size: 2,
      quantity: 1,
      ratePaise: 5000,
    };
    commit((p) => ({ ...p, trims: [...p.trims, t] }));
  };
  const updateTrim = (id: string, changes: Partial<Trim>) => {
    if (piece.locked) return;
    commit((p) => ({
      ...p,
      trims: p.trims.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    }));
  };
  const setPanelOpen = (next: Panel) => {
    setPanel(next);
    setMobileInspector(true);
    if (searchParams.get("tool") !== next)
      setSearchParams(
        (previous) => {
          previous.set("tool", next);
          return previous;
        },
        { replace: true },
      );
    if (next === "projects") workspace.refresh();
  };
  const requestedTool = searchParams.get("tool");
  useEffect(() => {
    if (requestedTool && sections.some((s) => s.id === requestedTool)) {
      setPanel(requestedTool as Panel);
      setMobileInspector(true);
      if (requestedTool === "projects") workspace.refresh();
    }
  }, [requestedTool]);
  useEffect(() => {
    if (mobileInspector && matchMedia("(max-width: 760px)").matches)
      requestAnimationFrame(() =>
        inspectorRef.current?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        }),
      );
  }, [mobileInspector, panel]);
  const exportProject = () => {
    download(
      `${project.id}.aura.json`,
      JSON.stringify(project, null, 2),
      "application/json",
    );
    setMessage(
      "Project exported. Keep this backup when moving to another browser or device.",
    );
  };
  const capture = () => {
    if (!apiRef.current) {
      setMessage("Open the 3D view before exporting an image.");
      return;
    }
    const a = document.createElement("a");
    a.href = apiRef.current.snapshot();
    a.download = "aura-garment-preview.png";
    a.click();
  };
  const applyPalette = (
    color: string,
    name: string,
    pattern: Material["pattern"],
    roughness: number,
  ) => patchMaterial({ color, name, pattern, roughness });
  const renderInspector = () => {
    if (panel === "measurements")
      return (
        <>
          <h3>Avatar & measurements</h3>
          <p className="atelier-help">
            Changes rebuild the mannequin. Pattern dimensions remain your design
            choices.
          </p>
          <div className="atelier-segmented">
            <button aria-pressed={unit === "cm"} onClick={() => setUnit("cm")}>
              Centimeters
            </button>
            <button aria-pressed={unit === "in"} onClick={() => setUnit("in")}>
              Inches
            </button>
          </div>
          {Object.entries(project.measurements).map(([key, value]) => (
            <NumberField
              key={key}
              label={`${key[0].toUpperCase() + key.slice(1)} measurement`}
              suffix={unit}
              value={unit === "cm" ? value : value / 2.54}
              min={
                (key === "height"
                  ? 120
                  : key === "shoulder"
                    ? 25
                    : key === "arm"
                      ? 30
                      : key === "waist"
                        ? 40
                        : 50) / (unit === "cm" ? 1 : 2.54)
              }
              max={
                (key === "height"
                  ? 220
                  : key === "shoulder"
                    ? 65
                    : key === "arm"
                      ? 85
                      : key === "hip"
                        ? 180
                        : key === "waist"
                          ? 150
                          : 160) / (unit === "cm" ? 1 : 2.54)
              }
              step={0.1}
              onChange={(v) =>
                commit((p) => ({
                  ...p,
                  measurements: {
                    ...p.measurements,
                    [key]:
                      Math.round(v * (unit === "cm" ? 1 : 2.54) * 100) / 100,
                  },
                }))
              }
            />
          ))}
          <label className="atelier-check">
            <input
              type="checkbox"
              checked={project.scene.showAvatar}
              onChange={(e) =>
                commit((p) => ({
                  ...p,
                  scene: { ...p.scene, showAvatar: e.target.checked },
                }))
              }
            />
            Show mannequin
          </label>
          <NumberField
            label="Target circumference ease"
            suffix="cm"
            value={easeCm}
            min={0}
            max={20}
            step={0.5}
            onChange={setEaseCm}
          />
          <button
            className="atelier-button green"
            onClick={() => commit((p) => applyMeasurementEase(p, easeCm))}
          >
            Apply measurements to unlocked patterns
          </button>
          <p className="atelier-help">
            Updates bodice circumferences, skirt waist and waistband. Locked
            components remain unchanged. Recheck construction and length
            separately.
          </p>
          <div className="atelier-callout">
            This mannequin represents entered circumferences approximately. It
            is not a body scan or a guarantee of fit.
          </div>
        </>
      );
    if (panel === "components")
      return (
        <>
          <h3>{piece.name}</h3>
          {piece.locked && (
            <p className="atelier-callout">This component is locked.</p>
          )}
          <label className="atelier-field">
            Component name
            <input
              maxLength={80}
              value={piece.name}
              disabled={piece.locked}
              onChange={(e) => {
                if (e.target.value.trim()) patchPiece({ name: e.target.value });
              }}
            />
          </label>
          <NumberField
            label="Top width"
            suffix="cm"
            value={piece.topCm}
            min={2}
            max={180}
            step={0.5}
            onChange={(v) => patchPiece({ topCm: v })}
            disabled={piece.locked}
          />
          <NumberField
            label="Bottom width"
            suffix="cm"
            value={piece.bottomCm}
            min={2}
            max={220}
            step={0.5}
            onChange={(v) => patchPiece({ bottomCm: v })}
            disabled={piece.locked}
          />
          <NumberField
            label="Pattern length"
            suffix="cm"
            value={piece.lengthCm}
            min={2}
            max={250}
            step={0.5}
            onChange={(v) => patchPiece({ lengthCm: v })}
            disabled={piece.locked}
          />
          <NumberField
            label="Seam allowance"
            suffix="cm"
            value={piece.seamCm}
            min={0}
            max={5}
            step={0.1}
            onChange={(v) => patchPiece({ seamCm: v })}
            disabled={piece.locked}
          />
          <NumberField
            label="Cut quantity"
            value={piece.cutCount}
            min={1}
            max={24}
            onChange={(v) => patchPiece({ cutCount: Math.round(v) })}
            disabled={piece.locked}
          />
          <div className="atelier-two-fields">
            <NumberField
              label="Sheet X"
              value={piece.x}
              min={0}
              max={800}
              step={1}
              onChange={(v) => patchPiece({ x: v })}
              disabled={piece.locked}
            />
            <NumberField
              label="Sheet Y"
              value={piece.y}
              min={0}
              max={800}
              step={1}
              onChange={(v) => patchPiece({ y: v })}
              disabled={piece.locked}
            />
          </div>
          <button
            className="atelier-button"
            disabled={piece.locked}
            onClick={() =>
              download(
                "aura-pattern.svg",
                exportPatternSvg(project, piece.id),
                "image/svg+xml",
              )
            }
          >
            <Download size={15} />
            Export selected pattern
          </button>
          <button
            className="atelier-button danger"
            disabled={piece.locked || project.pieces.length <= 1}
            onClick={removePiece}
          >
            <Trash2 size={15} />
            Remove component
          </button>
          <p className="atelier-help">
            Removing a component also removes its trims. Undo restores both.
          </p>
        </>
      );
    if (panel === "materials")
      return (
        <>
          <h3>Fabric & material editor</h3>
          <label className="atelier-field">
            Material for {piece.name}
            <select
              aria-label="Component material"
              disabled={piece.locked}
              value={piece.materialId}
              onChange={(e) => patchPiece({ materialId: e.target.value })}
            >
              {project.materials.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <p className="atelier-help">
            Material edits affect every component sharing this fabric.
          </p>
          <div className="fabric-presets">
            {[
              {
                color: "#9f1839",
                name: "Ruby brocade",
                pattern: "brocade",
                roughness: 0.62,
              },
              {
                color: "#075b4b",
                name: "Emerald velvet",
                pattern: "plain",
                roughness: 0.92,
              },
              {
                color: "#eadcb6",
                name: "Ivory silk",
                pattern: "floral",
                roughness: 0.35,
              },
              {
                color: "#223c69",
                name: "Indigo weave",
                pattern: "checks",
                roughness: 0.72,
              },
              {
                color: "#bb6a81",
                name: "Rose floral",
                pattern: "floral",
                roughness: 0.6,
              },
              {
                color: "#b78637",
                name: "Gold stripe",
                pattern: "stripes",
                roughness: 0.45,
              },
            ].map((m) => (
              <button
                aria-label={`Apply ${m.name}`}
                key={m.name}
                onClick={() =>
                  applyPalette(m.color, m.name, m.pattern as any, m.roughness)
                }
              >
                <span style={{ background: m.color }} />
                <small>{m.name}</small>
              </button>
            ))}
          </div>
          <label className="atelier-field">
            Fabric name
            <input
              maxLength={60}
              value={material.name}
              onChange={(e) => {
                if (e.target.value.trim())
                  patchMaterial({ name: e.target.value });
              }}
            />
          </label>
          <label className="atelier-color">
            Fabric color
            <input
              aria-label="Advanced fabric color"
              type="color"
              value={material.color}
              onChange={(e) => patchMaterial({ color: e.target.value })}
            />
            <code>{material.color}</code>
          </label>
          <label className="atelier-field">
            Pattern
            <select
              value={material.pattern}
              onChange={(e) =>
                patchMaterial({ pattern: e.target.value as any })
              }
            >
              {["plain", "brocade", "floral", "stripes", "checks"].map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <RangeField
            label="Surface roughness"
            value={material.roughness}
            onChange={(v) => patchMaterial({ roughness: v })}
          />
          <RangeField
            label="Metallic sheen"
            value={material.metalness}
            onChange={(v) => patchMaterial({ metalness: v })}
          />
          <RangeField
            label="Fabric opacity"
            value={material.opacity}
            min={0.15}
            onChange={(v) => patchMaterial({ opacity: v })}
          />
          <RangeField
            label="Texture scale"
            value={material.textureScale}
            min={0.25}
            max={8}
            step={0.25}
            onChange={(v) => patchMaterial({ textureScale: v })}
          />
          <NumberField
            label="Fabric weight"
            suffix="gsm"
            value={material.gsm}
            min={20}
            max={1500}
            onChange={(v) => patchMaterial({ gsm: v })}
          />
          <RangeField
            label="Stretch factor"
            value={material.stretch}
            max={0.5}
            onChange={(v) => patchMaterial({ stretch: v })}
          />
          <NumberField
            label="Fabric rate per meter"
            suffix="INR"
            value={material.ratePaise / 100}
            min={0}
            max={100000}
            step={0.01}
            onChange={(v) => patchMaterial({ ratePaise: Math.round(v * 100) })}
          />
          <button
            className="atelier-button"
            disabled={project.materials.length >= 20}
            onClick={() => {
              const m = {
                ...material,
                id: newId(),
                name: `${material.name} copy`,
              };
              commit((p) => ({
                ...p,
                materials: [...p.materials, m],
                pieces: p.pieces.map((x) =>
                  x.id === piece.id && !x.locked
                    ? { ...x, materialId: m.id }
                    : x,
                ),
              }));
            }}
          >
            Make an independent fabric copy
          </button>
        </>
      );
    if (panel === "trims")
      return (
        <>
          <h3>Trims & detailing</h3>
          <p className="atelier-help">
            Details apply to {piece.name}. Placement is measured from the top of
            its UV surface.
          </p>
          <label className="atelier-field">
            Detail type
            <select
              value={trimKind}
              onChange={(e) => setTrimKind(e.target.value as any)}
            >
              {["border", "embroidery", "buttons", "tassels"].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <button
            className="atelier-button green"
            disabled={piece.locked}
            onClick={addTrim}
          >
            <Plus size={15} />
            Add detail
          </button>
          {project.trims
            .filter((t) => t.pieceId === piece.id)
            .map((t) => (
              <div className="trim-editor" key={t.id}>
                <label className="atelier-field">
                  Detail name
                  <input
                    maxLength={60}
                    disabled={piece.locked}
                    value={t.name}
                    onChange={(e) => {
                      if (e.target.value.trim())
                        updateTrim(t.id, { name: e.target.value });
                    }}
                  />
                </label>
                <label className="atelier-color">
                  Detail color
                  <input
                    aria-label={`${t.name} color`}
                    type="color"
                    value={t.color}
                    disabled={piece.locked}
                    onChange={(e) =>
                      updateTrim(t.id, { color: e.target.value })
                    }
                  />
                </label>
                <RangeField
                  label={`${t.name} placement`}
                  value={t.position}
                  disabled={piece.locked}
                  onChange={(v) => updateTrim(t.id, { position: v })}
                />
                <RangeField
                  label={`${t.name} size`}
                  value={t.size}
                  min={0.3}
                  max={8}
                  step={0.1}
                  disabled={piece.locked}
                  onChange={(v) => updateTrim(t.id, { size: v })}
                />
                <NumberField
                  label={`${t.name} quantity`}
                  value={t.quantity}
                  min={0}
                  max={1000}
                  step={0.1}
                  disabled={piece.locked}
                  onChange={(v) => updateTrim(t.id, { quantity: v })}
                />
                <NumberField
                  label={`${t.name} unit rate`}
                  suffix="INR"
                  value={t.ratePaise / 100}
                  min={0}
                  max={10000}
                  step={0.01}
                  disabled={piece.locked}
                  onChange={(v) =>
                    updateTrim(t.id, { ratePaise: Math.round(v * 100) })
                  }
                />
                <button
                  className="atelier-button danger"
                  disabled={piece.locked}
                  onClick={() =>
                    commit((p) => ({
                      ...p,
                      trims: p.trims.filter((x) => x.id !== t.id),
                    }))
                  }
                >
                  Remove detail
                </button>
              </div>
            ))}
          {!project.trims.some((t) => t.pieceId === piece.id) && (
            <p className="atelier-help">No details on this component yet.</p>
          )}
        </>
      );
    if (panel === "simulation")
      return (
        <>
          <h3>Cloth preview</h3>
          <p className="atelier-help">
            A real-time mass-spring skirt preview with a pinned waist, gravity,
            wind, floor contact and an approximate body collision envelope. It
            is not a production cloth solver.
          </p>
          <button
            className="atelier-button green"
            onClick={() => setRunning((v) => !v)}
          >
            {running ? <Pause size={16} /> : <Play size={16} />}{" "}
            {running ? "Pause cloth preview" : "Run cloth preview"}
          </button>
          <button
            className="atelier-button"
            onClick={() => apiRef.current?.resetCloth()}
          >
            <RotateCcw size={15} />
            Reset drape
          </button>
          <RangeField
            label="Gravity"
            value={project.simulation.gravity}
            max={15}
            step={0.1}
            onChange={(v) =>
              commit((p) => ({
                ...p,
                simulation: { ...p.simulation, gravity: v },
              }))
            }
          />
          <RangeField
            label="Wind"
            value={project.simulation.wind}
            max={3}
            step={0.05}
            onChange={(v) =>
              commit((p) => ({
                ...p,
                simulation: { ...p.simulation, wind: v },
              }))
            }
          />
          <RangeField
            label="Constraint stiffness"
            value={project.simulation.stiffness}
            min={0.2}
            onChange={(v) =>
              commit((p) => ({
                ...p,
                simulation: { ...p.simulation, stiffness: v },
              }))
            }
          />
          <RangeField
            label="Motion damping"
            value={project.simulation.damping}
            min={0.8}
            max={0.995}
            step={0.005}
            onChange={(v) =>
              commit((p) => ({
                ...p,
                simulation: { ...p.simulation, damping: v },
              }))
            }
          />
          <label className="atelier-check">
            <input
              type="checkbox"
              checked={project.simulation.collisions}
              onChange={(e) =>
                commit((p) => ({
                  ...p,
                  simulation: { ...p.simulation, collisions: e.target.checked },
                }))
              }
            />
            Approximate avatar collisions
          </label>
          <label className="atelier-check">
            <input
              type="checkbox"
              checked={project.scene.wireframe}
              onChange={(e) =>
                commit((p) => ({
                  ...p,
                  scene: { ...p.scene, wireframe: e.target.checked },
                }))
              }
            />
            Show mesh wireframe
          </label>
          <p className="atelier-callout">
            Bodices, sleeves and dupatta are geometric previews. Self-collision,
            seam stitching and reliable pressure/strain analysis are not
            available.
          </p>
        </>
      );
    if (panel === "costing")
      return (
        <>
          <h3>Costing & bill of materials</h3>
          <p className="atelier-help">
            Your editable estimates. Fabric is laid out using a simple
            shelf-packing calculation with a waste allowance.
          </p>
          <NumberField
            label="Fabric width"
            suffix="cm"
            value={project.costing.fabricWidthCm}
            min={80}
            max={250}
            onChange={(v) =>
              commit((p) => ({
                ...p,
                costing: { ...p.costing, fabricWidthCm: v },
              }))
            }
          />
          <NumberField
            label="Fabric waste"
            suffix="%"
            value={project.costing.wastePercent}
            min={0}
            max={50}
            onChange={(v) =>
              commit((p) => ({
                ...p,
                costing: { ...p.costing, wastePercent: v },
              }))
            }
          />
          <NumberField
            label="Labour estimate"
            suffix="INR"
            value={project.costing.labourPaise / 100}
            min={0}
            max={1000000}
            onChange={(v) =>
              commit((p) => ({
                ...p,
                costing: { ...p.costing, labourPaise: Math.round(v * 100) },
              }))
            }
          />
          <NumberField
            label="Overhead allowance"
            suffix="%"
            value={project.costing.overheadPercent}
            min={0}
            max={100}
            onChange={(v) =>
              commit((p) => ({
                ...p,
                costing: { ...p.costing, overheadPercent: v },
              }))
            }
          />
          <NumberField
            label="Markup estimate"
            suffix="%"
            value={project.costing.markupPercent}
            min={0}
            max={300}
            onChange={(v) =>
              commit((p) => ({
                ...p,
                costing: { ...p.costing, markupPercent: v },
              }))
            }
          />
          {cost.lines.map((l) => (
            <div className="cost-line" key={l.id}>
              <span>
                {l.name}
                <small>
                  {l.overWidth
                    ? "Pattern exceeds fabric width"
                    : `${l.meters} m · ${l.weightGrams} g cut area`}
                </small>
              </span>
              <strong>{money(l.totalPaise)}</strong>
            </div>
          ))}
          <div className="cost-line">
            <span>Trims</span>
            <strong>{money(cost.trimPaise)}</strong>
          </div>
          <div className="cost-line">
            <span>Labour + overhead</span>
            <strong>
              {money(project.costing.labourPaise + cost.overheadPaise)}
            </strong>
          </div>
          <div className="cost-total">
            <span>Production estimate</span>
            <strong>
              {cost.complete ? money(cost.totalPaise) : "Check fabric width"}
            </strong>
          </div>
          <div className="cost-line">
            <span>With markup</span>
            <strong>
              {cost.complete ? money(cost.suggestedPaise) : "Incomplete"}
            </strong>
          </div>
          <button
            className="atelier-button"
            onClick={() =>
              download(
                "aura-bill-of-materials.csv",
                exportCostCsv(project),
                "text/csv",
              )
            }
          >
            <Download size={15} />
            Export BOM CSV
          </button>
          <p className="atelier-help">
            No tax, shipping or payment is included. These values do not create
            a price in the Shop.
          </p>
        </>
      );
    if (panel === "versions")
      return (
        <>
          <h3>Saved versions</h3>
          <p className="atelier-help">
            Keep up to 20 named snapshots for this project, stored on this
            device.
          </p>
          <label className="atelier-field">
            Version name
            <input
              maxLength={60}
              placeholder="e.g. Gold border revision"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
            />
          </label>
          <button
            className="atelier-button green"
            disabled={busy}
            onClick={() =>
              notify(async () => {
                await workspace.saveVersion(versionLabel);
                setVersionLabel("");
                setMessage("Version saved.");
              })
            }
          >
            <Save size={15} />
            Save named version
          </button>
          {workspace.revisions
            .slice()
            .reverse()
            .map((r) => (
              <div className="version-row" key={r.id}>
                <strong>{r.label}</strong>
                <small>{new Date(r.createdAt).toLocaleString()}</small>
                <button
                  className="atelier-button"
                  onClick={() => {
                    commit({ ...r.project, id: project.id });
                    setMessage(
                      `Restored ${r.label}. Undo returns to your previous design.`,
                    );
                  }}
                >
                  Restore version
                </button>
              </div>
            ))}
          {workspace.revisions.length === 0 && (
            <p className="atelier-help">
              No named versions yet. Autosave keeps your current work
              separately.
            </p>
          )}
        </>
      );
    if (panel === "projects")
      return (
        <>
          <h3>My local designs</h3>
          <label className="atelier-field">
            Start from
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as any)}
            >
              <option value="lehenga">Bridal lehenga</option>
              <option value="gown">Evening gown</option>
              <option value="blouse">Blouse</option>
            </select>
          </label>
          <button
            className="atelier-button green"
            disabled={busy}
            onClick={() =>
              notify(async () => {
                await workspace.newProject(template);
                await workspace.refresh();
                setMessage(
                  "New project created. Your previous project is saved.",
                );
              })
            }
          >
            <Plus size={15} />
            Create new project
          </button>
          <button
            className="atelier-button"
            onClick={() => importRef.current?.click()}
          >
            <Upload size={15} />
            Import AURA project
          </button>
          <button
            className="atelier-button"
            onClick={() => workspace.refresh()}
          >
            Refresh library
          </button>
          {workspace.library.map((item) => (
            <div className="project-library-card" key={item.project.id}>
              <span
                className="library-swatch"
                style={{ background: item.project.materials[0].color }}
              />
              <strong>{item.project.name}</strong>
              <small>
                {item.project.pieces.length} components ·{" "}
                {new Date(item.project.updatedAt).toLocaleDateString()}
              </small>
              <button
                className="atelier-button"
                disabled={busy}
                onClick={() => notify(() => workspace.openProject(item))}
              >
                Open project
              </button>
            </div>
          ))}
          <p className="atelier-callout">
            Projects are local to this browser and account. Export a backup for
            another device. No API keys or login are required to design.
          </p>
        </>
      );
    if (panel === "techpack")
      return (
        <>
          <h3>Tech pack & exports</h3>
          <p className="atelier-help">
            Export the actual components, measurements, fabrics, trims and costs
            in your current project.
          </p>
          <button
            className="atelier-button green"
            onClick={() => window.print()}
          >
            <Download size={15} />
            Print / save tech pack PDF
          </button>
          <button
            className="atelier-button"
            onClick={() =>
              download(
                "aura-pattern-sheet.svg",
                exportPatternSvg(project),
                "image/svg+xml",
              )
            }
          >
            Export measured SVG sheet
          </button>
          <button
            className="atelier-button"
            onClick={() =>
              download(
                "aura-bill-of-materials.csv",
                exportCostCsv(project),
                "text/csv",
              )
            }
          >
            Export cost sheet CSV
          </button>
          <button className="atelier-button" onClick={exportProject}>
            Export editable project
          </button>
          <label className="atelier-field">
            Construction notes
            <textarea
              maxLength={2000}
              value={project.notes}
              onChange={(e) => commit((p) => ({ ...p, notes: e.target.value }))}
            />
          </label>
          <div className="atelier-callout">
            Use the SVG's 10 cm calibration ruler before cutting. Printed
            tech-pack diagrams are illustrations, not actual-size cutting
            patterns.
          </div>
        </>
      );
    return (
      <>
        <h3>AI & connected services</h3>
        <h4>Local design checks</h4>
        <p className="atelier-help">
          Calculated from your project. These checks do not use AI.
        </p>
        {designChecks(project).map((check) => (
          <p className="atelier-callout" key={check.id}>
            {check.message}
          </p>
        ))}
        <div className="atelier-callout">
          <ShieldCheck size={18} />
          Local drafting, 3D, cloth preview, versions, costing and exports work
          without API keys.
        </div>
        <h4>AI design rendering</h4>
        <p className="atelier-help">
          {config.tryOnReady
            ? "Configured. Use the paid render flow in the sketch editor."
            : "Awaiting provider, pricing and payment configuration. No fabricated AI result is shown."}
        </p>
        <button
          className="atelier-button"
          disabled={busy || !config.tryOnReady || view === "2d"}
          onClick={() =>
            notify(async () => {
              await processSketch(
                await previewPng(),
                project.garment,
                null,
                project.notes,
              );
            })
          }
        >
          Render this 3D concept · {money(config.tryOnPrice)}
        </button>
        <Link className="atelier-button" to="/sketch">
          Open freehand sketch tools
        </Link>
        <h4>Photo try-on</h4>
        <p className="atelier-help">
          Photo-based try-on requires an approved product, explicit photo
          consent and a separately paid AI request.
        </p>
        <Link className="atelier-button" to="/shopping">
          Browse try-on products
        </Link>
        <h4>Community & boutiques</h4>
        <p className="atelier-help">
          {config.communityReady
            ? "Account services are configured."
            : "Account services will become available after Firebase configuration."}{" "}
          Export your tech pack now for review with a tailor.
        </p>
        <Link className="atelier-button" to="/boutique">
          Boutique quote inbox
        </Link>
        <Link className="atelier-button" to="/designs">
          Manage uploads & access requests
        </Link>
        <h4>Publish your project</h4>
        {entitlement && (
          <p className="atelier-help">
            {entitlement.publishCredits} upload credits ·{" "}
            {entitlement.pass?.remaining || 0} publishing-pass uploads
            available.
          </p>
        )}
        <label className="atelier-field">
          Who can use this project?
          <select
            value={publicationAccess}
            onChange={(e) => setPublicationAccess(e.target.value as any)}
          >
            <option value="approval">Only people I approve</option>
            <option value="public">Every signed-in user</option>
          </select>
        </label>
        <label className="atelier-check">
          <input
            type="checkbox"
            checked={rights}
            onChange={(e) => setRights(e.target.checked)}
          />
          I own this design and have the right to publish it.
        </label>
        <label className="atelier-check">
          <input
            type="checkbox"
            checked={dataConsent}
            onChange={(e) => setDataConsent(e.target.checked)}
          />
          I consent to sharing the included patterns, measurements and notes
          with the users allowed by this access setting.
        </label>
        <p className="atelier-help">
          The preview image becomes public. Approval controls editable files and
          custom try-on. Downloaded copies cannot be recalled.
        </p>
        <button
          className="atelier-button green"
          disabled={
            busy ||
            !rights ||
            !dataConsent ||
            !config.publishingReady ||
            view === "2d"
          }
          onClick={publishProject}
        >
          Publish using one upload entitlement
        </button>
        <button
          className="atelier-button"
          disabled={busy || !config.publishingReady}
          onClick={() => notify(() => checkout("publish"))}
        >
          Buy one upload · {money(config.publishPrice)}
        </button>
        <Link className="atelier-button" to="/subscription">
          View publishing passes
        </Link>
        {!config.publishingReady && (
          <p className="atelier-callout">
            Publication and payments stay disabled until your account services,
            prices and payment provider are configured. Local saving and exports
            remain free.
          </p>
        )}
      </>
    );
  };
  if (workspace.loading)
    return (
      <section className="panel">
        <p role="status">Opening your design workspace…</p>
      </section>
    );
  return (
    <div className="atelier-app reference-atelier">
      <div className="atelier-page-heading">
        <div>
          <p>AURA FASHION · BRIDAL ATELIER</p>
          <h2>3D Fashion Design Studio</h2>
          <span>Create · Simulate · Customize · Analyze · Render · Share</span>
        </div>
        <div className="atelier-heading-note">
          <span className="reference-motto">
            Design
            <br />
            Without Limits
            <small>
              FROM CONCEPT TO CREATION
              <br />
              IN 3D, 2D AND BEYOND
            </small>
          </span>
        </div>
      </div>
      {(message || workspace.error) && (
        <p role="alert" className="atelier-message">
          {message || workspace.error}
          <button
            aria-label="Dismiss notification"
            onClick={() => {
              setMessage("");
              workspace.setError("");
            }}
          >
            ×
          </button>
        </p>
      )}
      <div className="atelier-tabs" aria-label="Studio sections">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            aria-pressed={panel === id}
            key={id}
            onClick={() => setPanelOpen(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <div className="atelier-layout">
        <aside className="atelier-left">
          <section className="atelier-panel">
            <div className="atelier-panel-heading">
              <h3>
                <b className="panel-number">2</b> Garment components
              </h3>
              <span>{project.pieces.length}</span>
            </div>
            <div className="component-adder">
              <label className="sr-only" htmlFor="new-component">
                Component type
              </label>
              <select
                id="new-component"
                value={addKind}
                onChange={(e) => setAddKind(e.target.value as any)}
              >
                {kinds.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              <button aria-label="Add garment component" onClick={addPiece}>
                <Plus size={17} />
              </button>
            </div>
            <div className="component-list">
              {project.pieces.map((p) => (
                <div
                  className={`component-row ${p.id === piece.id ? "selected" : ""}`}
                  key={p.id}
                >
                  <button
                    className="component-name"
                    aria-pressed={p.id === piece.id}
                    onClick={() => {
                      setSelected(p.id);
                      setPanelOpen("components");
                    }}
                  >
                    <span
                      className="component-swatch"
                      style={{
                        background: project.materials.find(
                          (m) => m.id === p.materialId,
                        )!.color,
                      }}
                    />
                    {p.name}
                    <small>×{p.cutCount}</small>
                  </button>
                  <button
                    aria-label={`${p.visible ? "Hide" : "Show"} ${p.name}`}
                    onClick={() =>
                      commit((value) => ({
                        ...value,
                        pieces: value.pieces.map((x) =>
                          x.id === p.id ? { ...x, visible: !x.visible } : x,
                        ),
                      }))
                    }
                  >
                    {p.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    aria-label={`${p.locked ? "Unlock" : "Lock"} ${p.name}`}
                    onClick={() =>
                      commit((value) => ({
                        ...value,
                        pieces: value.pieces.map((x) =>
                          x.id === p.id ? { ...x, locked: !x.locked } : x,
                        ),
                      }))
                    }
                  >
                    {p.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>
                </div>
              ))}
            </div>
            <p className="atelier-help">
              Select a component here or in the 2D/3D view.
            </p>
          </section>
          <section className="atelier-panel">
            <div className="atelier-panel-heading">
              <h3>
                <b className="panel-number">1</b> Avatar & pose
              </h3>
              <Ruler size={15} />
            </div>
            <div className="reference-avatar">
              <svg
                viewBox="0 0 80 150"
                role="img"
                aria-label="Measurement mannequin illustration"
              >
                <defs>
                  <linearGradient id="avatar-shade">
                    <stop stopColor="#d5bfa6" />
                    <stop offset=".5" stopColor="#f2dfc8" />
                    <stop offset="1" stopColor="#bda68d" />
                  </linearGradient>
                </defs>
                <circle cx="40" cy="15" r="10" fill="url(#avatar-shade)" />
                <path
                  d="M34 25L20 34 13 76 19 79 28 45 28 70 22 92 28 140 36 140 40 100 44 140 52 140 58 92 52 70 52 45 61 79 67 76 60 34 46 25Z"
                  fill="url(#avatar-shade)"
                />
                <path
                  d="M28 40Q40 46 52 40L50 56Q40 62 30 56ZM26 78Q40 84 54 78L56 92 43 99 40 90 37 99 24 92Z"
                  fill="#67867b"
                />
                <path
                  d="M20 35H60M27 57H53M25 80H55"
                  stroke="#09634f"
                  strokeDasharray="2 2"
                />
              </svg>
              <div>
                <strong>Custom mannequin</strong>
                <p>Body measurements drive your preview.</p>
                <button onClick={() => setPanelOpen("measurements")}>
                  Measurements →
                </button>
                <button
                  onClick={() => {
                    setView("3d");
                    apiRef.current?.setView("front");
                  }}
                >
                  View avatar
                </button>
              </div>
            </div>
            <div className="avatar-summary">
              <span>
                Height <b>{project.measurements.height} cm</b>
              </span>
              <span>
                Bust <b>{project.measurements.bust} cm</b>
              </span>
              <span>
                Waist <b>{project.measurements.waist} cm</b>
              </span>
              <span>
                Hip <b>{project.measurements.hip} cm</b>
              </span>
            </div>
            <button
              className="atelier-button"
              onClick={() => setPanelOpen("measurements")}
            >
              Edit measurements
            </button>
            <div className="ease-readings">
              {fitReadings(project).map((r) => (
                <div key={r.label}>
                  <span>{r.label}</span>
                  <strong className={r.cm < 0 ? "negative" : ""}>
                    {r.cm > 0 ? "+" : ""}
                    {r.cm.toFixed(1)} cm
                  </strong>
                </div>
              ))}
            </div>
            <p className="atelier-help">
              Circumference comparison only. Check a sewn sample before
              production.
            </p>
          </section>
          <Link className="atelier-old-editor" to="/sketch">
            <ArrowLeft size={14} />
            Freehand sketch editor
          </Link>
        </aside>
        <div className="atelier-center">
          <div className="reference-command-row">
            <div className="atelier-workspace-bar">
              <div className="atelier-project-title">
                <input
                  ref={nameRef}
                  aria-label="Advanced project name"
                  maxLength={100}
                  value={project.name}
                  onChange={(e) => {
                    if (e.target.value.trim())
                      commit((p) => ({ ...p, name: e.target.value }));
                  }}
                />
                <span className="atelier-save-status" role="status">
                  <i />
                  {workspace.status}
                </span>
              </div>
              <div className="atelier-actions">
                <button
                  title="Undo"
                  aria-label="Advanced undo"
                  disabled={!workspace.canUndo}
                  onClick={workspace.undo}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  title="Redo"
                  aria-label="Advanced redo"
                  disabled={!workspace.canRedo}
                  onClick={workspace.redo}
                >
                  <Redo2 size={17} />
                </button>
                <button
                  aria-label="Open versions"
                  title="Versions"
                  onClick={() => setPanelOpen("versions")}
                >
                  <Save size={16} />
                  <span>Versions</span>
                </button>
                <button
                  aria-label="Download 3D image"
                  title="Download 3D image"
                  onClick={capture}
                >
                  <Download size={16} />
                  <span>3D image</span>
                </button>
                <button
                  aria-label="Export project"
                  title="Export project"
                  className="accent"
                  onClick={exportProject}
                >
                  <Download size={16} />
                  <span>Export project</span>
                </button>
              </div>
            </div>

            <div className="atelier-view-tabs">
              <button
                aria-pressed={view === "3d"}
                onClick={() => setView("3d")}
              >
                <Box size={15} />
                3D view
              </button>
              <button
                aria-pressed={view === "2d"}
                onClick={() => setView("2d")}
              >
                <Scissors size={15} />
                2D pattern
              </button>
              <button
                aria-pressed={view === "split"}
                onClick={() => setView("split")}
              >
                <Columns2 size={15} />
                Split view
              </button>
              <button
                className="inspector-toggle"
                onClick={() => setMobileInspector((v) => !v)}
              >
                <Settings2 size={15} />
                {mobileInspector ? "Close tools" : "Edit tools"}
              </button>
            </div>
          </div>
          <div className={`atelier-canvases view-${view}`}>
            {view !== "2d" && (
              <section className="atelier-panel garment-panel">
                <div className="atelier-panel-heading">
                  <h3>3D garment preview</h3>
                  <select
                    aria-label="Preview environment"
                    value={project.scene.background}
                    onChange={(e) =>
                      commit((p) => ({
                        ...p,
                        scene: {
                          ...p.scene,
                          background: e.target.value as any,
                        },
                      }))
                    }
                  >
                    <option value="atelier">Atelier</option>
                    <option value="warm">Warm studio</option>
                    <option value="night">Evening</option>
                  </select>
                </div>
                <div
                  className="reference-stage-tools"
                  aria-label="Garment tools"
                >
                  <button
                    title="Select component"
                    aria-label="Select garment component"
                    onClick={() => setPanelOpen("components")}
                  >
                    <Layers size={17} />
                    <span>Select</span>
                  </button>
                  <button
                    title="Arrange measured patterns"
                    aria-label="Arrange patterns"
                    onClick={() => setView("2d")}
                  >
                    <Columns2 size={17} />
                    <span>Arrange</span>
                  </button>
                  <button
                    title="Change fabric"
                    aria-label="Edit garment fabric"
                    onClick={() => setPanelOpen("materials")}
                  >
                    <Palette size={17} />
                    <span>Fabric</span>
                  </button>
                  <button
                    title="Edit dimensions"
                    aria-label="Edit garment dimensions"
                    onClick={() => setPanelOpen("components")}
                  >
                    <Ruler size={17} />
                    <span>Size</span>
                  </button>
                  <button
                    title="Add embroidery and trims"
                    aria-label="Edit garment details"
                    onClick={() => setPanelOpen("trims")}
                  >
                    <Scissors size={17} />
                    <span>Details</span>
                  </button>
                  <button
                    title="Save viewport image"
                    aria-label="Capture garment viewport"
                    onClick={capture}
                  >
                    <Download size={17} />
                    <span>Capture</span>
                  </button>
                </div>
                <Suspense
                  fallback={
                    <div className="atelier-viewport">
                      <p>Loading the 3D workspace…</p>
                    </div>
                  }
                >
                  <GarmentViewport
                    project={project}
                    running={running}
                    onSelect={(id) => {
                      setSelected(id);
                      setPanel("components");
                    }}
                    apiRef={apiRef}
                  />
                </Suspense>
                <div className="camera-controls">
                  {(["front", "back", "side", "perspective"] as const).map(
                    (v) => (
                      <button
                        key={v}
                        onClick={() => apiRef.current?.setView(v)}
                      >
                        {v === "perspective" ? "3/4 view" : v}
                      </button>
                    ),
                  )}
                </div>
                <div className="cloth-transport">
                  <button
                    aria-label={
                      running
                        ? "Pause garment simulation"
                        : "Start garment simulation"
                    }
                    onClick={() => setRunning((v) => !v)}
                  >
                    {running ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <span>
                    {running ? "Preview running" : "Preview paused"}
                    <small>Drag to rotate · scroll / pinch to zoom</small>
                  </span>
                  <button
                    aria-label="Reset garment simulation"
                    onClick={() => apiRef.current?.resetCloth()}
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              </section>
            )}
            {view !== "3d" && (
              <PatternViewport
                project={project}
                selected={piece.id}
                onSelect={(id) => {
                  setSelected(id);
                  setPanel("components");
                }}
                onMove={(id, x, y) =>
                  commit((p) => ({
                    ...p,
                    pieces: p.pieces.map((v) =>
                      v.id === id && !v.locked ? { ...v, x, y } : v,
                    ),
                  }))
                }
              />
            )}
          </div>
          <div className="reference-dock">
            <section className="atelier-panel">
              <div className="atelier-panel-heading">
                <h3>
                  <b className="panel-number">5</b> Trims & detailing
                </h3>
              </div>
              <div className="reference-trim-tiles">
                {["Border", "Embroidery", "Buttons", "Tassels"].map(
                  (label, i) => (
                    <button
                      key={label}
                      onClick={() => {
                        setTrimKind(
                          (
                            [
                              "border",
                              "embroidery",
                              "buttons",
                              "tassels",
                            ] as const
                          )[i],
                        );
                        setPanelOpen("trims");
                      }}
                    >
                      <span
                        className={`trim-tile trim-${i}`}
                        aria-hidden="true"
                      >
                        {["❧", "✥", "●", "♧"][i]}
                      </span>
                      {label}
                    </button>
                  ),
                )}
              </div>
              <button
                className="dock-text-button"
                onClick={() => setPanelOpen("trims")}
              >
                Placement, scale & cost →
              </button>
            </section>
            <section className="atelier-panel">
              <div className="atelier-panel-heading">
                <h3>
                  <b className="panel-number">6</b> Design colorways
                </h3>
              </div>
              <div className="reference-colorways">
                {[
                  ["#9f1839", "Royal ruby"],
                  ["#075b4b", "Emerald"],
                  ["#eadcb6", "Ivory"],
                  ["#223c69", "Midnight"],
                ].map(([color, label]) => (
                  <button
                    key={color}
                    aria-label={`Use ${label} colorway`}
                    onClick={() => patchMaterial({ color })}
                  >
                    <svg viewBox="0 0 48 70" aria-hidden="true">
                      <path
                        d="M18 4H30L34 22 46 66Q24 73 2 66L14 22Z"
                        fill={color}
                      />
                      <path
                        d="M6 58H42M10 46H38M15 22H33"
                        stroke="#d7b877"
                        strokeWidth="2"
                      />
                    </svg>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <button
                className="dock-text-button"
                onClick={() => setPanelOpen("versions")}
              >
                Save a colorway as a version →
              </button>
            </section>
            <section className="atelier-panel">
              <div className="atelier-panel-heading">
                <h3>
                  <b className="panel-number">7</b> Design assistant
                </h3>
              </div>
              <p className="dock-copy">{designChecks(project)[0]?.message}</p>
              <button
                className="dock-text-button"
                onClick={() => setPanelOpen("assistant")}
              >
                Review checks & AI services →
              </button>
            </section>
            <section className="atelier-panel">
              <div className="atelier-panel-heading">
                <h3>
                  <b className="panel-number">8</b> Fit analysis
                </h3>
              </div>
              <div className="reference-fit">
                {fitReadings(project).map((r) => (
                  <div key={r.label}>
                    <span>{r.label}</span>
                    <b className={r.cm < 0 ? "negative" : ""}>
                      {r.cm > 0 ? "+" : ""}
                      {r.cm.toFixed(1)} cm
                    </b>
                  </div>
                ))}
              </div>
              <p className="dock-copy">
                Calculated ease · verify with a sewn sample
              </p>
              <button
                className="dock-text-button"
                onClick={() => setPanelOpen("measurements")}
              >
                Review measurements →
              </button>
            </section>
          </div>
          <div className="atelier-bottom-summary">
            <div>
              <span>PROJECT</span>
              <strong>
                {project.pieces.length} components · {project.trims.length}{" "}
                details
              </strong>
            </div>
            <div>
              <span>ESTIMATED PRODUCTION COST</span>
              <strong>
                {cost.complete ? money(cost.totalPaise) : "Check fabric width"}
              </strong>
            </div>
            <button onClick={() => setPanelOpen("techpack")}>
              Review tech pack →
            </button>
          </div>
          {panel === "techpack" && <TechPack project={project} />}
        </div>
        <aside
          ref={inspectorRef}
          className={`atelier-inspector ${mobileInspector ? "mobile-open" : ""}`}
        >
          <div className="inspector-mobile-heading">
            <strong>Design tools</strong>
            <button onClick={() => setMobileInspector(false)}>Done</button>
          </div>
          <div className="reference-inspector-title">
            <b className="panel-number">3</b>
            <span>{sections.find((s) => s.id === panel)?.label}</span>
            <Settings2 size={14} />
          </div>
          <div className="reference-inspector-body">{renderInspector()}</div>
          <section className="reference-physics">
            <div className="atelier-panel-heading">
              <h3>
                <b className="panel-number">4</b> Simulation & physics
              </h3>
            </div>
            <dl>
              <div>
                <dt>Gravity</dt>
                <dd>{project.simulation.gravity} m/s²</dd>
              </div>
              <div>
                <dt>Stiffness</dt>
                <dd>{Math.round(project.simulation.stiffness * 100)}%</dd>
              </div>
              <div>
                <dt>Body collision</dt>
                <dd>{project.simulation.collisions ? "On" : "Off"}</dd>
              </div>
            </dl>
            <div className="reference-physics-actions">
              <button onClick={() => setPanelOpen("simulation")}>
                Settings
              </button>
              <button onClick={() => setRunning((v) => !v)}>
                {running ? "Pause" : "Simulate"}
              </button>
            </div>
          </section>
        </aside>
      </div>
      <div className="atelier-footer">
        <span>
          <i />
          Local workspace · no API required
        </span>
        <span>Pattern units: cm · {project.materials.length} fabrics</span>
        <Link to="/shopping">Shop & community</Link>
        <Link to="/tryon">Virtual try-on →</Link>
        <Link to="/boutique">Boutique quotes</Link>
        <button onClick={() => setPanelOpen("techpack")}>
          Tech pack & costing
        </button>
      </div>
      {panel !== "techpack" && (
        <div className="print-only">
          <TechPack project={project} />
        </div>
      )}
      <input
        ref={importRef}
        type="file"
        className="sr-only"
        aria-label="Import advanced AURA project"
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          notify(async () => {
            if (file.size > 1000000)
              throw new Error("Choose an AURA project smaller than 1 MB.");
            const imported = parseProject(await file.text());
            const next = { ...imported, id: newId(), updatedAt: Date.now() };
            await workspace.openProject({ project: next, revisions: [] });
            setMessage("Project imported as a new local copy.");
          });
        }}
      />
    </div>
  );
}
