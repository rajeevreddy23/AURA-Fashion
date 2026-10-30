import { z } from "zod";

export const pointSchema = z.object({
  x: z.number().min(0).max(600),
  y: z.number().min(0).max(600),
});
export const layerSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["pen", "line", "rect", "circle", "sticker", "image"]),
  x: z.number().min(0).max(600),
  y: z.number().min(0).max(600),
  width: z.number().min(1).max(600),
  height: z.number().min(1).max(600),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  stroke: z.number().min(1).max(40),
  points: z.array(pointSchema).max(3000).optional(),
  text: z.enum(["✿", "★", "♥", "◆", "🎀", "🦋"]).optional(),
  image: z
    .string()
    .max(450000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});
export const designSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(80),
  template: z.enum(["shirt", "dress", "skirt", "saree"]),
  fabric: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  layers: z.array(layerSchema).max(100),
});
export type Design = z.infer<typeof designSchema>;
export type Layer = z.infer<typeof layerSchema>;
export const templates = {
  shirt: {
    label: "Shirt",
    points: [
      [210, 110],
      [260, 110],
      [280, 135],
      [320, 135],
      [340, 110],
      [390, 110],
      [490, 200],
      [440, 270],
      [390, 235],
      [390, 500],
      [210, 500],
      [210, 235],
      [160, 270],
      [110, 200],
    ],
    preview: true,
  },
  dress: {
    label: "Dress",
    points: [
      [230, 100],
      [270, 100],
      [280, 130],
      [320, 130],
      [330, 100],
      [370, 100],
      [400, 220],
      [350, 280],
      [460, 510],
      [140, 510],
      [250, 280],
      [200, 220],
    ],
    preview: true,
  },
  skirt: {
    label: "Lehenga / skirt",
    points: [
      [230, 170],
      [370, 170],
      [470, 510],
      [130, 510],
    ],
    preview: true,
  },
  saree: {
    label: "Saree panel",
    points: [
      [100, 120],
      [500, 120],
      [500, 500],
      [100, 500],
    ],
    preview: false,
  },
};
export function templatePath(template: Design["template"]) {
  return (
    templates[template].points
      .map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`)
      .join(" ") + " Z"
  );
}
export const blankDesign = (): Design => ({
  version: 1,
  name: "My new design",
  template: "shirt",
  fabric: "#cbb8eb",
  layers: [],
});
export function historyPush<T>(history: T[], index: number, value: T) {
  return [...history.slice(0, index + 1), value].slice(-50);
}
