import { z } from "zod";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const finite = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
export const materialSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  color,
  pattern: z.enum(["plain", "brocade", "floral", "stripes", "checks"]),
  roughness: finite(0, 1),
  metalness: finite(0, 1),
  opacity: finite(0.15, 1),
  textureScale: finite(0.25, 8),
  ratePaise: finite(0, 10000000).int(),
  gsm: finite(20, 1500),
  stretch: finite(0, 0.5),
});
export const pieceSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  kind: z.enum([
    "bodice-front",
    "bodice-back",
    "skirt",
    "sleeve",
    "dupatta",
    "waistband",
    "lining",
  ]),
  materialId: id,
  topCm: finite(2, 180),
  bottomCm: finite(2, 220),
  lengthCm: finite(2, 250),
  seamCm: finite(0, 5),
  cutCount: z.number().int().min(1).max(24),
  x: finite(0, 800),
  y: finite(0, 800),
  // Layout currently supports translation; reject unsupported rotations rather than silently dropping them.
  rotation: z.literal(0),
  visible: z.boolean(),
  locked: z.boolean(),
});
export const trimSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["border", "embroidery", "buttons", "tassels"]),
  pieceId: id,
  color,
  position: finite(0, 1),
  size: finite(0.3, 8),
  quantity: finite(0, 1000),
  ratePaise: finite(0, 1000000).int(),
});
export const projectSchema = z
  .object({
    format: z.literal("aura-studio"),
    version: z.literal(2),
    id,
    name: z.string().trim().min(1).max(100),
    notes: z.string().max(2000),
    updatedAt: z.number().int().nonnegative(),
    garment: z.enum(["lehenga", "gown", "blouse"]),
    measurements: z.object({
      height: finite(120, 220),
      bust: finite(50, 160),
      waist: finite(40, 150),
      hip: finite(50, 180),
      shoulder: finite(25, 65),
      arm: finite(30, 85),
    }),
    materials: z.array(materialSchema).min(1).max(20),
    pieces: z.array(pieceSchema).min(1).max(40),
    trims: z.array(trimSchema).max(100),
    costing: z.object({
      fabricWidthCm: finite(80, 250),
      wastePercent: finite(0, 50),
      labourPaise: finite(0, 100000000).int(),
      overheadPercent: finite(0, 100),
      markupPercent: finite(0, 300),
    }),
    simulation: z.object({
      gravity: finite(0, 15),
      wind: finite(0, 3),
      stiffness: finite(0.2, 1),
      damping: finite(0.8, 0.995),
      collisions: z.boolean(),
    }),
    scene: z.object({
      background: z.enum(["atelier", "warm", "night"]),
      showAvatar: z.boolean(),
      wireframe: z.boolean(),
    }),
  })
  .superRefine((p, ctx) => {
    const mats = new Set(p.materials.map((m) => m.id)),
      parts = new Set(p.pieces.map((x) => x.id));
    if (
      mats.size !== p.materials.length ||
      parts.size !== p.pieces.length ||
      new Set(p.trims.map((t) => t.id)).size !== p.trims.length
    )
      ctx.addIssue({ code: "custom", message: "Identifiers must be unique." });
    if (
      p.pieces.some((x) => !mats.has(x.materialId)) ||
      p.trims.some((t) => !parts.has(t.pieceId))
    )
      ctx.addIssue({
        code: "custom",
        message: "A component references a missing material or pattern.",
      });
  });
export type Project = z.infer<typeof projectSchema>;
export type Piece = Project["pieces"][number];
export type Material = Project["materials"][number];
export type Trim = Project["trims"][number];
export const newId = () => crypto.randomUUID();
export function createProject(
  garment: Project["garment"] = "lehenga",
): Project {
  const piece = (
    kind: Piece["kind"],
    name: string,
    topCm: number,
    bottomCm: number,
    lengthCm: number,
    x: number,
    y: number,
    cutCount = 1,
  ): Piece => ({
    id: newId(),
    kind,
    name,
    materialId: "silk",
    topCm,
    bottomCm,
    lengthCm,
    seamCm: 1.5,
    cutCount,
    x,
    y,
    rotation: 0,
    visible: true,
    locked: false,
  });
  const pieces = [
    piece("bodice-front", "Blouse front", 48, 39, 35, 8, 8),
    piece("bodice-back", "Blouse back", 48, 39, 35, 68, 8),
    piece("sleeve", "Sleeve", 34, 26, 24, 128, 8, 2),
  ];
  if (garment !== "blouse")
    pieces.push(
      piece(
        "skirt",
        garment === "gown" ? "Gown skirt panel" : "Lehenga panel",
        10,
        42,
        100,
        8,
        58,
        8,
      ),
      piece("waistband", "Waistband", 76, 76, 5, 68, 58),
    );
  if (garment === "lehenga")
    pieces.push(piece("dupatta", "Dupatta", 90, 90, 220, 160, 58));
  const project: Project = {
    format: "aura-studio",
    version: 2,
    id: newId(),
    name:
      garment === "lehenga"
        ? "Royal bridal lehenga"
        : garment === "gown"
          ? "Evening gown"
          : "Signature blouse",
    notes:
      "Review measurements, seams and construction with your tailor before cutting.",
    updatedAt: Date.now(),
    garment,
    measurements: {
      height: 165,
      bust: 88,
      waist: 70,
      hip: 96,
      shoulder: 38,
      arm: 56,
    },
    materials: [
      {
        id: "silk",
        name: "Ruby silk brocade",
        color: "#9f1839",
        pattern: "brocade",
        roughness: 0.62,
        metalness: 0.12,
        opacity: 1,
        textureScale: 2,
        ratePaise: 85000,
        gsm: 180,
        stretch: 0.03,
      },
      {
        id: "lining",
        name: "Cotton lining",
        color: "#e8cdb9",
        pattern: "plain",
        roughness: 0.9,
        metalness: 0,
        opacity: 1,
        textureScale: 1,
        ratePaise: 22000,
        gsm: 100,
        stretch: 0.02,
      },
    ],
    pieces,
    trims: [],
    costing: {
      fabricWidthCm: 140,
      wastePercent: 10,
      labourPaise: 180000,
      overheadPercent: 12,
      markupPercent: 25,
    },
    simulation: {
      gravity: 9.8,
      wind: 0.25,
      stiffness: 0.8,
      damping: 0.97,
      collisions: true,
    },
    scene: { background: "atelier", showAvatar: true, wireframe: false },
  };
  if (garment !== "blouse")
    project.trims.push({
      id: newId(),
      name: "Gold hem border",
      kind: "border",
      pieceId: pieces[3].id,
      color: "#d2aa57",
      position: 0.96,
      size: 3,
      quantity: 3.5,
      ratePaise: 9000,
    });
  return project;
}
export function parseProject(text: string): Project {
  if (text.length > 1000000)
    throw new Error("Project file is too large. The limit is 1 MB.");
  try {
    return projectSchema.parse(JSON.parse(text));
  } catch {
    throw new Error(
      "This is not a supported AURA project. Use a version 2 project exported from the advanced Studio.",
    );
  }
}
export function pieceOutline(p: Piece): [number, number][] {
  const offset = (Math.max(p.topCm, p.bottomCm) - p.topCm) / 2;
  const bottomOffset = (Math.max(p.topCm, p.bottomCm) - p.bottomCm) / 2;
  if (p.kind === "bodice-front" || p.kind === "bodice-back")
    return [
      [offset, 0],
      [offset + p.topCm * 0.3, 0],
      [offset + p.topCm * 0.38, p.lengthCm * 0.14],
      [offset + p.topCm * 0.62, p.lengthCm * 0.14],
      [offset + p.topCm * 0.7, 0],
      [offset + p.topCm, 0],
      [offset + p.topCm * 0.9, p.lengthCm * 0.35],
      [bottomOffset + p.bottomCm, p.lengthCm],
      [bottomOffset, p.lengthCm],
      [offset + p.topCm * 0.1, p.lengthCm * 0.35],
    ];
  return [
    [offset, 0],
    [offset + p.topCm, 0],
    [bottomOffset + p.bottomCm, p.lengthCm],
    [bottomOffset, p.lengthCm],
  ];
}
export function piecePath(p: Piece) {
  return (
    pieceOutline(p)
      .map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`)
      .join(" ") + " Z"
  );
}
export function patternArea(p: Piece) {
  const points = pieceOutline(p);
  return (
    Math.abs(
      points.reduce((s, a, i) => {
        const b = points[(i + 1) % points.length];
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0),
    ) / 2
  );
}
export function materialCost(project: Project) {
  const lines = project.materials.map((m) => {
    const pieces = project.pieces.filter((p) => p.materialId === m.id);
    const cuts = pieces.flatMap((p) =>
      Array.from({ length: p.cutCount }, () => ({
        w: Math.max(p.topCm, p.bottomCm) + p.seamCm * 2,
        h: p.lengthCm + p.seamCm * 2,
      })),
    );
    const rows: { used: number; height: number }[] = [];
    let overWidth = false;
    cuts
      .sort((a, b) => b.h - a.h)
      .forEach((c) => {
        if (c.w > project.costing.fabricWidthCm) {
          overWidth = true;
          return;
        }
        const row = rows.find(
          (r) =>
            r.used + c.w <= project.costing.fabricWidthCm && c.h <= r.height,
        );
        if (row) row.used += c.w;
        else rows.push({ used: c.w, height: c.h });
      });
    const meters =
      Math.ceil(
        (rows.reduce((sum, r) => sum + r.height, 0) / 100) *
          (1 + project.costing.wastePercent / 100) *
          10,
      ) / 10;
    const areaCm2 = pieces.reduce((s, p) => s + patternArea(p) * p.cutCount, 0);
    return {
      id: m.id,
      name: m.name,
      meters,
      ratePaise: m.ratePaise,
      totalPaise: Math.round(meters * m.ratePaise),
      areaCm2,
      weightGrams: Math.round((areaCm2 / 10000) * m.gsm),
      overWidth,
    };
  });
  const fabricPaise = lines.reduce((s, l) => s + l.totalPaise, 0),
    trimPaise = project.trims.reduce(
      (s, t) => s + Math.round(t.quantity * t.ratePaise),
      0,
    );
  const directPaise = fabricPaise + trimPaise + project.costing.labourPaise,
    overheadPaise = Math.round(
      (directPaise * project.costing.overheadPercent) / 100,
    ),
    totalPaise = directPaise + overheadPaise;
  return {
    lines,
    fabricPaise,
    trimPaise,
    directPaise,
    overheadPaise,
    totalPaise,
    suggestedPaise: Math.round(
      totalPaise * (1 + project.costing.markupPercent / 100),
    ),
    complete: !lines.some((l) => l.overWidth),
  };
}
export function fitReadings(p: Project) {
  const bodices = p.pieces.filter(
    (x) => x.kind === "bodice-front" || x.kind === "bodice-back",
  );
  const skirt = p.pieces.find((x) => x.kind === "skirt");
  return [
    {
      label: "Bust ease",
      cm:
        bodices.reduce((s, x) => s + x.topCm * x.cutCount, 0) -
        p.measurements.bust,
    },
    {
      label: "Waist ease",
      cm:
        (skirt
          ? skirt.topCm * skirt.cutCount
          : bodices.reduce((s, x) => s + x.bottomCm * x.cutCount, 0)) -
        p.measurements.waist,
    },
  ].map((x) => ({
    ...x,
    status: x.cm < 0 ? "Too small" : x.cm > 14 ? "Very loose" : "Review fit",
  }));
}
export function designChecks(project: Project) {
  const checks: {
    id: string;
    severity: "warning" | "info";
    message: string;
  }[] = [];
  const fit = fitReadings(project);
  fit
    .filter((r) => r.cm < 0)
    .forEach((r) =>
      checks.push({
        id: r.label,
        severity: "warning",
        message: `${r.label} is ${r.cm.toFixed(1)} cm. The garment circumference is smaller than the entered body measurement.`,
      }),
    );
  project.pieces.forEach((p) => {
    if (
      Math.max(p.topCm, p.bottomCm) + 2 * p.seamCm >
      project.costing.fabricWidthCm
    )
      checks.push({
        id: `width-${p.id}`,
        severity: "warning",
        message: `${p.name} exceeds your fabric width, including seam allowance. Its fabric estimate is incomplete.`,
      });
    if (p.seamCm === 0)
      checks.push({
        id: `seam-${p.id}`,
        severity: "info",
        message: `${p.name} has no seam allowance. Confirm whether this is intentional before cutting.`,
      });
    if (
      (p.kind === "skirt" || p.kind === "lining") &&
      Math.abs(((p.bottomCm - p.topCm) * p.cutCount) / (2 * Math.PI)) >=
        p.lengthCm
    )
      checks.push({
        id: `flare-${p.id}`,
        severity: "warning",
        message: `${p.name} needs pleats, gathers or a different assembly to achieve this flare. The simple 3D preview is not reliable for these dimensions.`,
      });
  });
  if (!checks.length)
    checks.push({
      id: "review",
      severity: "info",
      message:
        "No basic dimensional conflicts found. Confirm fit, seam construction and fabric behavior with a sewn sample.",
    });
  return checks;
}
export function applyMeasurementEase(
  project: Project,
  easeCm: number,
): Project {
  const ease = Math.max(0, Math.min(20, easeCm)),
    bodices = project.pieces.filter(
      (p) => p.kind === "bodice-front" || p.kind === "bodice-back",
    ),
    count = bodices
      .filter((p) => !p.locked)
      .reduce((n, p) => n + p.cutCount, 0);
  const lockedTop = bodices
      .filter((p) => p.locked)
      .reduce((s, p) => s + p.topCm * p.cutCount, 0),
    lockedBottom = bodices
      .filter((p) => p.locked)
      .reduce((s, p) => s + p.bottomCm * p.cutCount, 0);
  return projectSchema.parse({
    ...project,
    pieces: project.pieces.map((p) =>
      p.locked
        ? p
        : p.kind === "bodice-front" || p.kind === "bodice-back"
          ? {
              ...p,
              topCm: Math.max(
                2,
                Math.min(
                  180,
                  (project.measurements.bust + ease - lockedTop) / count,
                ),
              ),
              bottomCm: Math.max(
                2,
                Math.min(
                  220,
                  (project.measurements.waist + ease - lockedBottom) / count,
                ),
              ),
            }
          : p.kind === "skirt"
            ? {
                ...p,
                topCm: Math.max(
                  2,
                  Math.min(
                    180,
                    (project.measurements.waist + ease) / p.cutCount,
                  ),
                ),
              }
            : p.kind === "waistband"
              ? {
                  ...p,
                  topCm: project.measurements.waist + ease,
                  bottomCm: project.measurements.waist + ease,
                }
              : p,
    ),
  });
}
function escapeXml(s: string) {
  return s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}
export function exportPatternSvg(project: Project, pieceId?: string) {
  const pieces = project.pieces.filter((p) => !pieceId || p.id === pieceId);
  if (!pieces.length) throw new Error("Choose a valid pattern component.");
  const margin = 5;
  const width =
    Math.max(
      ...pieces.map(
        (p) =>
          (pieceId ? 0 : p.x) + Math.max(p.topCm, p.bottomCm) + p.seamCm * 2,
      ),
    ) +
    margin * 2;
  const height =
    Math.max(
      ...pieces.map((p) => (pieceId ? 0 : p.y) + p.lengthCm + p.seamCm * 2),
    ) +
    margin * 2 +
    12;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 10}mm" height="${height * 10}mm" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="5" y="4" font-size="2.3">${escapeXml(project.name)} — dimensions in cm; print at 100%, verify ruler before cutting</text>${pieces.map((p) => `<g transform="translate(${(pieceId ? 0 : p.x) + margin + p.seamCm} ${(pieceId ? 0 : p.y) + margin + p.seamCm + 5})"><path d="${piecePath(p)}" fill="none" stroke="#777" stroke-width="${p.seamCm * 2}" stroke-linejoin="round"/><path d="${piecePath(p)}" fill="white" stroke="black" stroke-width=".15"/><path d="M${Math.max(p.topCm, p.bottomCm) / 2} 3 v${Math.max(1, p.lengthCm - 6)}" stroke="black" stroke-width=".1" stroke-dasharray="1 1"/><text x="2" y="${p.lengthCm / 2}" font-size="2">${escapeXml(p.name)} · cut ${p.cutCount}</text><text x="2" y="${p.lengthCm / 2 + 3}" font-size="1.5">Seam allowance ${p.seamCm} cm outside stitch line</text></g>`).join("")}<path d="M5 ${height - 4}h10 m-10 -1v2 m10 -2v2" stroke="black" stroke-width=".15"/><text x="18" y="${height - 3}" font-size="2">10 cm calibration</text></svg>`;
}
export function exportCostCsv(p: Project) {
  const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const safe = (s: string) =>
    quote(/^[\s\uFEFF]*[=+@-]/.test(s) || /^[\t\r]/.test(s) ? "'" + s : s);
  const c = materialCost(p);
  return [
    "Item,Quantity,Unit,Rate INR,Total INR",
    ...c.lines.map(
      (l) =>
        `${safe(l.name)},${l.meters},m,${l.ratePaise / 100},${l.totalPaise / 100}`,
    ),
    ...p.trims.map(
      (t) =>
        `${safe(t.name)},${t.quantity},unit,${t.ratePaise / 100},${Math.round(t.quantity * t.ratePaise) / 100}`,
    ),
    `Labour,1,job,${p.costing.labourPaise / 100},${p.costing.labourPaise / 100}`,
    `Overheads,1,total,${c.overheadPaise / 100},${c.overheadPaise / 100}`,
    `Estimated total,1,total,${c.totalPaise / 100},${c.totalPaise / 100}`,
  ].join("\r\n");
}
