import React, { useMemo, useRef, useState } from "react";
import { Project, Piece, piecePath } from "../../shared/workspace";
import { fabricCanvas } from "./fabricCanvas";
export default function PatternViewport({
  project,
  selected,
  onSelect,
  onMove,
}: {
  project: Project;
  selected: string;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(100);
  const [grid, setGrid] = useState(true);
  const [showFabric, setShowFabric] = useState(true);
  const fabricImages = useMemo(
    () =>
      Object.fromEntries(
        project.pieces.map((p) => [
          p.id,
          fabricCanvas(
            project.materials.find((m) => m.id === p.materialId)!,
            project.trims.filter((t) => t.pieceId === p.id),
          ).toDataURL(),
        ]),
      ),
    [project.materials, project.trims, project.pieces],
  );
  const [seams, setSeams] = useState(true);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const gesture = useRef<{
    id: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const width = Math.max(
      240,
      ...project.pieces.map((p) => p.x + Math.max(p.topCm, p.bottomCm) + 10),
    ),
    height = Math.max(300, ...project.pieces.map((p) => p.y + p.lengthCm + 15));
  const point = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * width,
      y: ((e.clientY - r.top) / r.height) * height,
    };
  };
  const down = (e: React.PointerEvent, p: Piece) => {
    if (!e.isPrimary || e.button !== 0) return;
    e.stopPropagation();
    onSelect(p.id);
    if (p.locked) return;
    const pos = point(e);
    gesture.current = {
      id: p.id,
      startX: pos.x,
      startY: pos.y,
      x: p.x,
      y: p.y,
    };
    setDrag({ id: p.id, x: p.x, y: p.y });
    svg.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const pos = point(e);
    setDrag({
      id: g.id,
      x: Math.min(800, Math.max(0, g.x + pos.x - g.startX)),
      y: Math.min(800, Math.max(0, g.y + pos.y - g.startY)),
    });
  };
  const finish = (cancel = false) => {
    if (!gesture.current) return;
    gesture.current = null;
    if (drag && !cancel) onMove(drag.id, drag.x, drag.y);
    setDrag(null);
  };
  return (
    <section className="atelier-panel pattern-panel">
      <div className="atelier-panel-heading">
        <h3>2D pattern drafting</h3>
        <span>cm · synced dimensions</span>
      </div>
      <div className="pattern-tools">
        <label>
          <input
            type="checkbox"
            checked={showFabric}
            onChange={(e) => setShowFabric(e.target.checked)}
          />
          Fabric
        </label>
        <label>
          <input
            type="checkbox"
            checked={grid}
            onChange={(e) => setGrid(e.target.checked)}
          />
          Grid
        </label>
        <label>
          <input
            type="checkbox"
            checked={seams}
            onChange={(e) => setSeams(e.target.checked)}
          />
          Seam allowance
        </label>
        <label>
          Zoom
          <select
            aria-label="Pattern zoom"
            value={zoom}
            onChange={(e) => setZoom(+e.target.value)}
          >
            {[75, 100, 125, 150, 200].map((z) => (
              <option value={z} key={z}>
                {z}%
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="pattern-scroll">
        <svg
          ref={svg}
          role="group"
          aria-label="Editable garment pattern sheet in centimeters. Select a component in the list or drag a pattern."
          data-testid="pattern-sheet"
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: `${zoom}%`, minWidth: `${zoom}%` }}
          onPointerMove={move}
          onPointerUp={() => finish()}
          onPointerCancel={() => finish(true)}
          onLostPointerCapture={() => finish()}
        >
          <defs>
            {project.pieces.map((p) => (
              <pattern
                key={p.id}
                id={`fabric-${p.id}`}
                width="1"
                height="1"
                patternContentUnits="objectBoundingBox"
              >
                <image
                  href={fabricImages[p.id]}
                  width="1"
                  height="1"
                  preserveAspectRatio="none"
                />
              </pattern>
            ))}
            <pattern
              id="atelier-fine-grid"
              width="1"
              height="1"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M1 0H0V1"
                fill="none"
                stroke="#dce7e2"
                strokeWidth=".06"
              />
            </pattern>
            <pattern
              id="atelier-grid"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <rect width="10" height="10" fill="url(#atelier-fine-grid)" />
              <path
                d="M10 0H0V10"
                fill="none"
                stroke="#dce7e2"
                strokeWidth=".18"
              />
            </pattern>
          </defs>
          <rect
            width={width}
            height={height}
            fill={grid ? "url(#atelier-grid)" : "#fffef9"}
          />
          {project.pieces.map((p) => {
            const material = project.materials.find(
              (m) => m.id === p.materialId,
            )!;
            const x = drag?.id === p.id ? drag.x : p.x,
              y = drag?.id === p.id ? drag.y : p.y,
              w = Math.max(p.topCm, p.bottomCm);
            return (
              <g
                key={p.id}
                data-piece={p.id}
                role="button"
                tabIndex={0}
                aria-label={`${p.name} pattern${p.locked ? ", locked" : ""}. Arrow keys move 1 cm; Shift moves 10 cm.`}
                aria-pressed={selected === p.id}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(p.id);
                  }
                  const delta = (
                    {
                      ArrowLeft: [-1, 0],
                      ArrowRight: [1, 0],
                      ArrowUp: [0, -1],
                      ArrowDown: [0, 1],
                    } as Record<string, number[]>
                  )[e.key];
                  if (!delta) return;
                  e.preventDefault();
                  if (p.locked) return;
                  const step = e.shiftKey ? 10 : 1;
                  onMove(
                    p.id,
                    Math.max(0, Math.min(800, p.x + delta[0] * step)),
                    Math.max(0, Math.min(800, p.y + delta[1] * step)),
                  );
                }}
                transform={`translate(${x} ${y})`}
                opacity={p.visible ? 1 : 0.3}
                onPointerDown={(e) => down(e, p)}
                style={{ cursor: p.locked ? "not-allowed" : "move" }}
              >
                {seams && (
                  <path
                    d={piecePath(p)}
                    stroke={selected === p.id ? "#8db9aa" : "#c4abae"}
                    strokeWidth={p.seamCm * 2}
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}
                <path
                  d={piecePath(p)}
                  fill={showFabric ? `url(#fabric-${p.id})` : material.color}
                  fillOpacity={showFabric ? 0.85 : 0.24}
                  stroke={selected === p.id ? "#08745e" : "#6a8b7a"}
                  strokeWidth={selected === p.id ? ".45" : ".25"}
                />
                <path
                  d={`M${w / 2} 4V${Math.max(5, p.lengthCm - 5)}`}
                  stroke="#779687"
                  strokeWidth=".25"
                  strokeDasharray="2 1"
                />
                <rect
                  x={w / 2 - Math.min(w - 3, 44) / 2}
                  y={p.lengthCm / 2 - 4}
                  width={Math.min(w - 3, 44)}
                  height="11"
                  rx="1"
                  fill="#fffdf4"
                  opacity=".92"
                  pointerEvents="none"
                />
                <text
                  x={w / 2}
                  y={p.lengthCm / 2}
                  textAnchor="middle"
                  fontSize="3.2"
                  fill="#254c3c"
                >
                  {p.name}
                </text>
                <text
                  x={w / 2}
                  y={p.lengthCm / 2 + 5}
                  textAnchor="middle"
                  fontSize="2.6"
                  fill="#456b58"
                >
                  Cut {p.cutCount} · {p.topCm} / {p.bottomCm} × {p.lengthCm} cm
                </text>
                {p.locked && (
                  <text x="2" y="4" fontSize="2.7">
                    Locked
                  </text>
                )}
              </g>
            );
          })}
          <path d={`M8 ${height - 8}H28`} stroke="#315b47" strokeWidth=".5" />
          <text x="8" y={height - 3} fontSize="2.8" fill="#456b58">
            20 cm
          </text>
        </svg>
      </div>
      <p className="atelier-help">
        Drag to arrange, or focus a pattern and use arrow keys (Shift: 10 cm).
        Edit real dimensions in Components. The outer line includes seam
        allowance; the inner line is the stitch line.
      </p>
    </section>
  );
}
