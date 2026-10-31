import React from "react";
import {
  Project,
  materialCost,
  piecePath,
  fitReadings,
} from "../../shared/workspace";
import { money } from "../services/api";
export default function TechPack({ project }: { project: Project }) {
  const cost = materialCost(project);
  return (
    <article className="atelier-techpack" id="aura-techpack">
      <header>
        <p>AURA FASHION · DESIGN SPECIFICATION</p>
        <h2>{project.name}</h2>
        <span>
          {project.garment} · Revision date{" "}
          {new Date(project.updatedAt).toLocaleDateString()} · Units: cm
        </span>
      </header>
      <section>
        <h3>Body measurements</h3>
        <table>
          <tbody>
            {Object.entries(project.measurements).map(([key, value]) => (
              <tr key={key}>
                <th>{key}</th>
                <td>{value} cm</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Measurements are user supplied. Confirm construction and fit with a
          qualified tailor.
        </p>
      </section>
      <section>
        <h3>Pattern components</h3>
        <div className="tech-patterns">
          {project.pieces.map((p) => (
            <figure key={p.id}>
              <svg
                viewBox={`-4 -4 ${Math.max(p.topCm, p.bottomCm) + 8} ${p.lengthCm + 8}`}
                role="img"
                aria-label={p.name}
              >
                <path
                  d={piecePath(p)}
                  fill="#e9ede7"
                  stroke="#315d48"
                  strokeWidth=".5"
                />
              </svg>
              <figcaption>
                <strong>{p.name}</strong>
                <br />
                {p.topCm} / {p.bottomCm} × {p.lengthCm} cm · cut {p.cutCount}
                <br />
                Seam allowance {p.seamCm} cm ·{" "}
                {project.materials.find((m) => m.id === p.materialId)?.name}
              </figcaption>
            </figure>
          ))}
        </div>
        <p>
          Diagrams in this document are scaled illustrations. Use the separately
          exported SVG and verify its calibration ruler for actual-size pattern
          plotting.
        </p>
      </section>
      <section>
        <h3>Materials & estimated costs</h3>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Estimated length</th>
              <th>Rate / m</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {cost.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{l.overWidth ? "Width exceeded" : `${l.meters} m`}</td>
                <td>{money(l.ratePaise)}</td>
                <td>{money(l.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Fabric width {project.costing.fabricWidthCm} cm · waste{" "}
          {project.costing.wastePercent}% · shelf-packing estimate, not an
          optimized production marker.
        </p>
        <table>
          <tbody>
            <tr>
              <th>Trims</th>
              <td>{money(cost.trimPaise)}</td>
            </tr>
            <tr>
              <th>Labour</th>
              <td>{money(project.costing.labourPaise)}</td>
            </tr>
            <tr>
              <th>Overhead</th>
              <td>{money(cost.overheadPaise)}</td>
            </tr>
            <tr>
              <th>Estimated production total</th>
              <td>
                {cost.complete
                  ? money(cost.totalPaise)
                  : "Incomplete: pattern exceeds fabric width"}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <section>
        <h3>Trims & detailing</h3>
        {project.trims.length ? (
          project.trims.map((t) => (
            <p key={t.id}>
              {t.name} · {t.kind} ·{" "}
              {project.pieces.find((p) => p.id === t.pieceId)?.name} · quantity{" "}
              {t.quantity} · {t.color}
            </p>
          ))
        ) : (
          <p>No trims specified.</p>
        )}
        <h3>Ease checks</h3>
        {fitReadings(project).map((r) => (
          <p key={r.label}>
            {r.label}: {r.cm.toFixed(1)} cm · {r.status}
          </p>
        ))}
        <p>
          Ease is a circumference comparison. It is not a simulated pressure,
          strain or fit certification.
        </p>
        <h3>Construction notes</h3>
        <p className="construction-notes">
          {project.notes || "No additional notes."}
        </p>
      </section>
    </article>
  );
}
