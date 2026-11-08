import type { Project, Material } from "../../shared/workspace";
export function fabricCanvas(material: Material, trims: Project["trims"] = []) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = material.color;
  c.fillRect(0, 0, 512, 512);
  c.strokeStyle = "#f3d18c";
  c.fillStyle = "#edc77e";
  c.globalAlpha = 0.58;
  const spacing = 64 / material.textureScale;
  for (let y = 0; y < 512; y += spacing)
    for (let x = 0; x < 512; x += spacing) {
      if (material.pattern === "brocade" || material.pattern === "floral") {
        c.save();
        c.translate(x + spacing / 2, y + spacing / 2);
        for (let petal = 0; petal < 6; petal++) {
          c.rotate(Math.PI / 3);
          c.beginPath();
          c.ellipse(
            0,
            spacing * 0.12,
            spacing * 0.055,
            spacing * 0.14,
            0,
            0,
            Math.PI * 2,
          );
          c.stroke();
        }
        c.beginPath();
        c.arc(0, 0, spacing * 0.04, 0, Math.PI * 2);
        c.fill();
        if (material.pattern === "brocade") {
          c.beginPath();
          c.moveTo(0, -spacing * 0.4);
          c.lineTo(spacing * 0.4, 0);
          c.lineTo(0, spacing * 0.4);
          c.lineTo(-spacing * 0.4, 0);
          c.closePath();
          c.lineWidth = 0.7;
          c.stroke();
        }
        c.restore();
      }
    }
  if (material.pattern === "stripes" || material.pattern === "checks") {
    c.lineWidth = Math.max(1, spacing * 0.13);
    for (let x = 0; x < 512; x += spacing) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 512);
      c.stroke();
    }
    if (material.pattern === "checks")
      for (let y = 0; y < 512; y += spacing) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(512, y);
        c.stroke();
      }
  }
  c.globalAlpha = 1;
  trims.forEach((t) => {
    c.fillStyle = t.color;
    c.strokeStyle = t.color;
    const y = t.position * 512,
      h = Math.max(2, t.size * 4);
    if (t.kind === "border") {
      c.fillRect(0, y - h / 2, 512, h);
      c.fillStyle = material.color;
      c.globalAlpha = 0.5;
      for (let x = 4; x < 512; x += 16) {
        c.beginPath();
        c.arc(x, y, h * 0.2, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    if (t.kind === "embroidery")
      for (let x = 12; x < 512; x += 40) {
        c.beginPath();
        c.arc(x, y, 8, 0, Math.PI * 2);
        c.stroke();
      }
    if (t.kind === "buttons")
      for (let x = 48; x < 512; x += 80) {
        c.beginPath();
        c.arc(x, y, h * 0.5, 0, Math.PI * 2);
        c.fill();
      }
    if (t.kind === "tassels")
      for (let x = 16; x < 512; x += 60) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + h * 2);
        c.lineWidth = 3;
        c.stroke();
      }
  });
  return canvas;
}
