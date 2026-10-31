import { Project, Piece } from "./workspace";
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function avatarSection(p: Project, y: number) {
  const h = p.measurements.height,
    m = p.measurements;
  const nodes = [
    {
      y: h * 0.47,
      x: (m.hip / (2 * Math.PI)) * 1.12,
      z: (m.hip / (2 * Math.PI)) * 0.9,
    },
    {
      y: h * 0.51,
      x: (m.hip / (2 * Math.PI)) * 1.12,
      z: (m.hip / (2 * Math.PI)) * 0.9,
    },
    {
      y: h * 0.6,
      x: (m.waist / (2 * Math.PI)) * 1.12,
      z: (m.waist / (2 * Math.PI)) * 0.9,
    },
    {
      y: h * 0.73,
      x: (m.bust / (2 * Math.PI)) * 1.12,
      z: (m.bust / (2 * Math.PI)) * 0.9,
    },
    { y: h * 0.8, x: m.shoulder / 2, z: m.shoulder * 0.25 },
    { y: h * 0.85, x: 6, z: 6 },
  ];
  for (let i = 1; i < nodes.length; i++)
    if (y <= nodes[i].y) {
      const a = nodes[i - 1],
        b = nodes[i],
        t = Math.max(0, (y - a.y) / (b.y - a.y));
      return { x: mix(a.x, b.x, t), z: mix(a.z, b.z, t) };
    }
  return { x: 6, z: 6 };
}
export function bodiceSection(project: Project, piece: Piece, t: number) {
  const upperX = (piece.topCm / Math.PI) * 1.12,
    upperZ = (piece.topCm / Math.PI) * 0.9;
  const hemX = (piece.bottomCm / Math.PI) * 1.12,
    hemZ = (piece.bottomCm / Math.PI) * 0.9;
  const ease = piece.topCm * 2 - project.measurements.bust;
  const shoulderX = project.measurements.shoulder / 2 + ease / 4,
    shoulderZ = project.measurements.shoulder * 0.25 + ease / 8;
  if (t < 0.3)
    return {
      x: mix(Math.max(2, shoulderX), upperX, t / 0.3),
      z: mix(Math.max(2, shoulderZ), upperZ, t / 0.3),
    };
  return {
    x: mix(upperX, hemX, (t - 0.3) / 0.7),
    z: mix(upperZ, hemZ, (t - 0.3) / 0.7),
  };
}
