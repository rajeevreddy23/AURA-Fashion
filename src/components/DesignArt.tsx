import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Design, Layer, templatePath } from "../../shared/studio";

export function LayerArt({ layer: l }: { layer: Layer }) {
  const common = {
    stroke: l.color,
    strokeWidth: l.stroke,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (l.kind === "pen")
    return (
      <path
        {...common}
        d={l.points?.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ")}
      />
    );
  if (l.kind === "line")
    return (
      <line
        {...common}
        x1={l.x}
        y1={l.y}
        x2={l.x + l.width}
        y2={l.y + l.height}
      />
    );
  if (l.kind === "rect")
    return (
      <rect
        {...common}
        x={l.x}
        y={l.y}
        width={l.width}
        height={l.height}
        rx="5"
      />
    );
  if (l.kind === "circle")
    return (
      <ellipse
        {...common}
        cx={l.x + l.width / 2}
        cy={l.y + l.height / 2}
        rx={l.width / 2}
        ry={l.height / 2}
      />
    );
  if (l.kind === "sticker")
    return (
      <text
        x={l.x + l.width / 2}
        y={l.y + l.height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={Math.min(l.width, l.height)}
        fill={l.color}
      >
        {l.text}
      </text>
    );
  return (
    <image
      href={l.image}
      x={l.x}
      y={l.y}
      width={l.width}
      height={l.height}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
export function DesignArt({
  design,
  transparent = false,
}: {
  design: Design;
  transparent?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 600 600"
      width="600"
      height="600"
    >
      {!transparent && <rect width="600" height="600" fill="white" />}
      <path
        d={templatePath(design.template)}
        fill={design.fabric}
        stroke="#272238"
        strokeWidth="2"
      />
      {design.layers.map((l) => (
        <LayerArt key={l.id} layer={l} />
      ))}
    </svg>
  );
}
export function svgText(design: Design, transparent = false) {
  return renderToStaticMarkup(
    <DesignArt design={design} transparent={transparent} />,
  );
}
export async function pngImage(design: Design) {
  const url = URL.createObjectURL(
    new Blob([svgText(design)], { type: "image/svg+xml" }),
  );
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image export is unavailable.");
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function download(name: string, data: string, type: string) {
  const u = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
