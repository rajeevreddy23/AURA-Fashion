import {
  createProject,
  newId,
  projectSchema,
  type Project,
  type Material,
} from "./workspace";
export type DressLook = {
  id: string;
  name: string;
  garment: Project["garment"];
  color: string;
  accent: string;
  pattern: Material["pattern"];
  skirt: number;
  sleeve: number;
  motifScale: number;
  description: string;
};
export const DRESS_LOOKS: DressLook[] = [
  {
    id: "royal-ruby",
    name: "Royal Ruby Bridal",
    garment: "lehenga",
    color: "#9f1839",
    accent: "#d9b56c",
    pattern: "brocade",
    skirt: 46,
    sleeve: 24,
    motifScale: 0.7,
    description:
      "Ruby silk with gold floral embroidery and a layered hem border.",
  },
  {
    id: "emerald-palace",
    name: "Emerald Palace",
    garment: "lehenga",
    color: "#075b4b",
    accent: "#d5b76e",
    pattern: "brocade",
    skirt: 40,
    sleeve: 32,
    motifScale: 0.85,
    description: "Emerald brocade, elbow sleeves and antique gold borders.",
  },
  {
    id: "rose-garden",
    name: "Rose Garden",
    garment: "lehenga",
    color: "#bc7589",
    accent: "#f3d9b7",
    pattern: "floral",
    skirt: 44,
    sleeve: 16,
    motifScale: 0.6,
    description: "Dusty rose floral panels with a delicate champagne border.",
  },
  {
    id: "ivory-pearl",
    name: "Ivory Pearl",
    garment: "lehenga",
    color: "#e7dcc1",
    accent: "#a27c37",
    pattern: "floral",
    skirt: 38,
    sleeve: 30,
    motifScale: 0.8,
    description:
      "Ivory floral silk with warm gold detailing and a contrasting dupatta.",
  },
  {
    id: "midnight-zari",
    name: "Midnight Zari",
    garment: "lehenga",
    color: "#253452",
    accent: "#d3b578",
    pattern: "brocade",
    skirt: 48,
    sleeve: 20,
    motifScale: 0.55,
    description:
      "Midnight blue, generous skirt volume and statement zari-inspired borders.",
  },
  {
    id: "saffron-festival",
    name: "Saffron Festival",
    garment: "lehenga",
    color: "#bf692a",
    accent: "#f4d4a1",
    pattern: "stripes",
    skirt: 36,
    sleeve: 18,
    motifScale: 0.5,
    description: "Saffron vertical stripes and bright embroidered hems.",
  },
  {
    id: "velvet-nocturne",
    name: "Velvet Nocturne",
    garment: "gown",
    color: "#263f45",
    accent: "#c3a76c",
    pattern: "plain",
    skirt: 32,
    sleeve: 48,
    motifScale: 0.7,
    description:
      "Deep teal evening gown with long sleeves and a quiet gold hem.",
  },
  {
    id: "lavender-bloom",
    name: "Lavender Bloom",
    garment: "gown",
    color: "#8d7aa6",
    accent: "#e4d4e5",
    pattern: "floral",
    skirt: 40,
    sleeve: 16,
    motifScale: 0.6,
    description: "Lavender floral gown with a full skirt and short sleeves.",
  },
  {
    id: "champagne-gala",
    name: "Champagne Gala",
    garment: "gown",
    color: "#c6a37b",
    accent: "#f9e5bc",
    pattern: "brocade",
    skirt: 44,
    sleeve: 26,
    motifScale: 0.65,
    description: "Champagne brocade ball gown with ornate hem bands.",
  },
  {
    id: "sapphire-column",
    name: "Sapphire Evening",
    garment: "gown",
    color: "#234f80",
    accent: "#c6d4e2",
    pattern: "plain",
    skirt: 24,
    sleeve: 40,
    motifScale: 0.8,
    description:
      "Sapphire evening gown with a restrained A-line skirt and silver detailing.",
  },
  {
    id: "ruby-soiree",
    name: "Ruby Soiree",
    garment: "gown",
    color: "#7d2447",
    accent: "#dda5b5",
    pattern: "floral",
    skirt: 34,
    sleeve: 20,
    motifScale: 0.45,
    description: "Wine floral gown, soft flared skirt and rose-toned borders.",
  },
  {
    id: "ivory-check",
    name: "Ivory Atelier",
    garment: "gown",
    color: "#dfd5c6",
    accent: "#8a6b4d",
    pattern: "checks",
    skirt: 28,
    sleeve: 35,
    motifScale: 0.55,
    description: "Warm ivory woven checks with a tailored A-line silhouette.",
  },
  {
    id: "ruby-blouse",
    name: "Ruby Zari Blouse",
    garment: "blouse",
    color: "#a32140",
    accent: "#e1bd6b",
    pattern: "brocade",
    skirt: 0,
    sleeve: 24,
    motifScale: 0.7,
    description: "Ruby brocade blouse with embellished cuffs and hem.",
  },
  {
    id: "peacock-blouse",
    name: "Peacock Silk Blouse",
    garment: "blouse",
    color: "#176b70",
    accent: "#d3b259",
    pattern: "floral",
    skirt: 0,
    sleeve: 30,
    motifScale: 0.65,
    description: "Peacock teal floral silk with gold cuff bands.",
  },
  {
    id: "gold-blouse",
    name: "Gold Celebration",
    garment: "blouse",
    color: "#ba8a38",
    accent: "#f5deb0",
    pattern: "brocade",
    skirt: 0,
    sleeve: 18,
    motifScale: 0.8,
    description: "Golden brocade blouse with small repeating motifs.",
  },
  {
    id: "rose-blouse",
    name: "Rose Petal Blouse",
    garment: "blouse",
    color: "#b97e8a",
    accent: "#f4d8c4",
    pattern: "floral",
    skirt: 0,
    sleeve: 12,
    motifScale: 0.5,
    description:
      "Rose floral blouse with short sleeves and delicate hem embroidery.",
  },
  {
    id: "indigo-blouse",
    name: "Indigo Woven Blouse",
    garment: "blouse",
    color: "#35496d",
    accent: "#c2c5d6",
    pattern: "checks",
    skirt: 0,
    sleeve: 36,
    motifScale: 0.6,
    description:
      "Indigo woven check blouse with elbow sleeves and silver-toned cuffs.",
  },
  {
    id: "ivory-blouse",
    name: "Ivory Silk Blouse",
    garment: "blouse",
    color: "#e9deca",
    accent: "#ac8242",
    pattern: "plain",
    skirt: 0,
    sleeve: 22,
    motifScale: 0.65,
    description: "Simple ivory silk blouse with a gold embroidered hem.",
  },
];
export function createDressLook(id: string): Project {
  const look = DRESS_LOOKS.find((item) => item.id === id);
  if (!look) throw new Error("Dress design was not found.");
  const p = createProject(look.garment);
  p.name = look.name;
  p.notes = `${look.description} Sample design; material rates are illustrative. Verify construction and fit before cutting.`;
  p.materials[0] = {
    ...p.materials[0],
    name: look.name + " fabric",
    color: look.color,
    pattern: look.pattern,
    textureScale: look.motifScale,
    roughness: look.pattern === "plain" ? 0.8 : 0.55,
  };
  p.materials.push({
    ...p.materials[0],
    id: "accent",
    name: "Coordinating dupatta",
    color: look.accent,
    pattern: "floral",
    opacity: 0.82,
    textureScale: 0.6,
  });
  for (const piece of p.pieces) {
    if (piece.kind === "skirt") piece.bottomCm = look.skirt;
    if (piece.kind === "sleeve") piece.lengthCm = look.sleeve;
    if (piece.kind === "dupatta") piece.materialId = "accent";
  }
  p.trims = [];
  for (const piece of p.pieces.filter((x) =>
    ["skirt", "sleeve", "bodice-front", "bodice-back", "dupatta"].includes(
      x.kind,
    ),
  )) {
    const color = piece.kind === "dupatta" ? look.color : look.accent;
    p.trims.push({
      id: newId(),
      name: "Coordinated hem border",
      kind: "border",
      pieceId: piece.id,
      color,
      position: 0.95,
      size: piece.kind === "skirt" ? 4 : 1.3,
      quantity: 1,
      ratePaise: 9000,
    });
    p.trims.push({
      id: newId(),
      name: "Floral embroidered band",
      kind: "embroidery",
      pieceId: piece.id,
      color,
      position: piece.kind === "skirt" ? 0.84 : 0.82,
      size: 1.4,
      quantity: 1,
      ratePaise: 6000,
    });
  }
  return projectSchema.parse(p);
}
export function dressPrompt(look: DressLook) {
  return `A realistic ${look.garment === "blouse" ? "female upper-body fashion mannequin wearing a fitted blouse" : "full-length female fashion mannequin wearing a " + look.garment}. ${look.description} Clearly defined garment silhouette, symmetrical construction, relaxed standing A-pose, arms separated from torso, natural fabric folds, complete front and back, detailed fabric surface. No pedestal, background objects, text or watermark.`;
}
