import { Link } from "react-router-dom";
import { useState } from "react";
import { DRESS_LOOKS, type DressLook } from "../../shared/lookLibrary";
import "../studio/looks.css";
export function LookCard({ look }: { look: DressLook }) {
  return (
    <article className="look-card">
      <div
        className="look-art"
        style={{
          background: `linear-gradient(145deg, ${look.accent}44, #faf6f1)`,
        }}
      >
        <svg
          viewBox="0 0 160 200"
          role="img"
          aria-label={`${look.name} design illustration`}
        >
          <defs>
            <pattern
              id={`motif-${look.id}`}
              width="13"
              height="13"
              patternUnits="userSpaceOnUse"
            >
              <path
                d={
                  look.pattern === "stripes"
                    ? "M4 0V13"
                    : look.pattern === "checks"
                      ? "M0 0H13V13"
                      : "M6 2Q12 6 6 11Q0 6 6 2M2 6H11"
                }
                stroke={look.accent}
                fill="none"
                strokeWidth=".8"
              />
            </pattern>
          </defs>
          <path
            d="M57 26L38 36 24 75 41 82 53 51 58 87H102L107 51 119 82 136 75 122 36 103 26Q80 42 57 26Z"
            fill={look.color}
          />
          <path
            d="M57 26L38 36 24 75 41 82 53 51 58 87H102L107 51 119 82 136 75 122 36 103 26Q80 42 57 26Z"
            fill={`url(#motif-${look.id})`}
            opacity={look.pattern === "plain" ? 0 : 0.7}
          />
          {look.garment !== "blouse" && (
            <>
              <path
                d={`M58 92H102L${105 + look.skirt} 181Q80 200 ${55 - look.skirt} 181Z`}
                fill={look.color}
              />
              <path
                d={`M58 92H102L${105 + look.skirt} 181Q80 200 ${55 - look.skirt} 181Z`}
                fill={`url(#motif-${look.id})`}
                opacity={look.pattern === "plain" ? 0 : 0.7}
              />
              <path
                d={`M${57 - look.skirt} 177Q80 194 ${103 + look.skirt} 177`}
                fill="none"
                stroke={look.accent}
                strokeWidth="6"
              />
            </>
          )}
          <path d="M58 84H102" stroke={look.accent} strokeWidth="4" />
        </svg>
        <span>Editable sample</span>
      </div>
      <div className="look-copy">
        <small>{look.garment}</small>
        <h3>{look.name}</h3>
        <p>{look.description}</p>
        <div className="look-buttons">
          <Link className="primary" to={`/studio?look=${look.id}`}>
            Edit this dress
          </Link>
          <Link to={`/modeling?look=${look.id}`}>Create with Meshy →</Link>
        </div>
      </div>
    </article>
  );
}
export default function DressLibrary({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const looks = compact
    ? [DRESS_LOOKS[0], DRESS_LOOKS[7], DRESS_LOOKS[13]]
    : DRESS_LOOKS.filter((l) => filter === "all" || l.garment === filter);
  return (
    <section className="dress-library" aria-label="Dress design library">
      <div className="look-heading">
        <div>
          <p className="eyebrow">DESIGNED TO MAKE YOUR OWN</p>
          <h2>
            {compact
              ? "Explore dress designs"
              : "18 dresses. Your next starting point."}
          </h2>
          <p>
            Editable silhouettes, coordinated fabrics and borders. Choose a
            look, then make it yours.
          </p>
        </div>
        {compact && <Link to="/looks">See all 18 designs →</Link>}
      </div>
      {!compact && (
        <label className="look-filter">
          Dress type
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All designs</option>
            <option value="lehenga">Lehengas</option>
            <option value="gown">Gowns</option>
            <option value="blouse">Blouses</option>
          </select>
        </label>
      )}
      <div className="look-grid">
        {looks.map((look) => (
          <LookCard key={look.id} look={look} />
        ))}
      </div>
    </section>
  );
}
