import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Box, Palette, Search, Shirt, Store } from "lucide-react";
import { WOMEN_PRODUCTS } from "../constants";
import { api, money } from "../services/api";
import type { Product } from "../types";
import { catalogImage, missingCatalogImage } from "../services/catalogMedia";
import DressLibrary from "../components/DressLibrary";
const shortcuts = [
  { path: "/tryon", Icon: Shirt, label: "Try On" },
  { path: "/studio", Icon: Palette, label: "Design Studio" },
  { path: "/boutique", Icon: Store, label: "Boutiques" },
  { path: "/modeling", Icon: Box, label: "3D View" },
];
export default function HomePage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState(WOMEN_PRODUCTS);
  const [sampleNotice, setSampleNotice] = useState("");
  useEffect(() => {
    let alive = true;
    api<Product[]>("/products")
      .then((value) => {
        if (alive) setProducts(value.filter((p) => p.gender === "women"));
      })
      .catch(() => {
        if (alive)
          setSampleNotice(
            "Showing the sample collection while the catalog is unavailable.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  const featured = ["w1", "w4", "w6", "w3"]
    .map((id) => products.find((p) => p.id === id)!)
    .filter(Boolean);
  return (
    <div className="aura-home">
      {sampleNotice && (
        <p className="notice" role="status">
          {sampleNotice}
        </p>
      )}
      <form
        className="aura-home-search"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          navigate(
            `/shopping?q=${encodeURIComponent(String(data.get("q") || ""))}`,
          );
        }}
      >
        <Search size={17} />
        <input
          name="q"
          aria-label="Search dresses and designs"
          placeholder="Search dresses, sarees, lehengas…"
        />
      </form>
      <section className="aura-home-hero">
        <div>
          <p className="hero-kicker">
            <span /> THE AURA ATELIER
          </p>
          <h1>
            An idea.
            <br />
            An outfit.
            <br />
            <em>Entirely yours.</em>
          </h1>
          <p className="hero-description">
            Dream up your next occasion. Explore beautiful pieces, design your
            own, and see where your imagination takes you.
          </p>
          <div className="hero-actions">
            <Link className="primary" to="/shopping">
              Get started <ArrowRight size={17} />
            </Link>
            <Link className="hero-studio-link" to="/studio">
              Enter the design studio <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero-footnote">
            <span>YOUR PERSONAL FASHION WORKSPACE</span>
            <span>01 / THE BRIDAL EDIT</span>
          </div>
        </div>
        <figure className="aura-home-photo">
          <img
            src="/brand/bridal-hero.webp"
            alt="Illustrative bridal design inspiration, created with AI"
            fetchPriority="high"
          />
          <figcaption>
            <span>THE OCCASION EDIT</span>Made for your moment.
            <small>AI-created bridal inspiration</small>
          </figcaption>
        </figure>
      </section>
      <div className="editorial-ribbon">
        <span>Imagine it.</span>
        <span>Design it.</span>
        <span>Make it yours.</span>
        <span aria-hidden="true">✦</span>
      </div>
      <nav className="aura-home-shortcuts" aria-label="Create your look">
        {shortcuts.map(({ path, Icon, label }) => (
          <Link to={path} key={label}>
            <Icon size={25} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="aura-home-heading">
        <h3>Shop by category</h3>
        <Link to="/shopping">View all →</Link>
      </div>
      <div className="aura-category-tiles">
        {featured.map((p) => (
          <Link
            to={`/shopping?q=${encodeURIComponent(p.name.split(" ").slice(-1)[0])}`}
            key={p.id}
          >
            <img
              src={catalogImage(p)}
              onError={missingCatalogImage}
              alt=""
              loading="lazy"
            />
            <span>
              {p.id === "w4"
                ? "Occasion sets"
                : p.category === "saries"
                  ? "Sarees"
                  : p.category === "lehangas"
                    ? "Lehengas"
                    : p.category === "shirts"
                      ? "Blouses"
                      : p.category.charAt(0).toUpperCase() +
                        p.category.slice(1)}
            </span>
          </Link>
        ))}
      </div>
      <div className="aura-home-heading">
        <h3>The occasion edit</h3>
        <Link to="/shopping">Explore →</Link>
      </div>
      <div className="aura-home-products">
        {featured.map((p) => (
          <Link key={p.id} to={`/product/${p.id}`}>
            <img
              src={catalogImage(p)}
              onError={missingCatalogImage}
              alt={p.name}
              loading="lazy"
            />
            <h4>{p.name}</h4>
            <span>{money(p.price * 100)}</span>
          </Link>
        ))}
      </div>
      <section className="aura-creator-card">
        <div>
          <p>FOR DESIGNERS & BOUTIQUES</p>
          <h3>Your next collection starts here.</h3>
          <span>
            Create locally, then choose a publishing plan when you’re ready to
            share.
          </span>
        </div>
        <Link className="primary" to="/subscription">
          View plans <ArrowRight size={15} />
        </Link>
      </section>
      <DressLibrary compact />
    </div>
  );
}
