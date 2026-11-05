import React, { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Heart, ArrowUpRight } from "lucide-react";
import { MEN_PRODUCTS, WOMEN_PRODUCTS } from "../constants";
import { api, money, useConfiguration } from "../services/api";
import { Product } from "../types";
import { auth } from "../firebase";
import { catalogImage, missingCatalogImage } from "../services/catalogMedia";
export default function Shopping() {
  const { gender = "women" } = useParams();
  const navigate = useNavigate();
  const config = useConfiguration();
  const [products, setProducts] = useState<Product[]>([
    ...MEN_PRODUCTS,
    ...WOMEN_PRODUCTS,
  ]);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popular");
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  useEffect(() => setQuery(searchParams.get("q") || ""), [searchParams]);
  const [source, setSource] = useState("all");
  const [liked, setLiked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<Product[]>("/products")
      .then((p) => {
        if (alive) setProducts(p);
      })
      .catch(() => {
        if (alive)
          setMessage(
            "Community products are unavailable. Showing the sample catalog.",
          );
      });
    if (auth.currentUser)
      api<string[]>("/likes")
        .then((v) => {
          if (alive) setLiked(v);
        })
        .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => setCategory("all"), [gender]);
  const categories = [
    "all",
    ...new Set(
      products.filter((p) => p.gender === gender).map((p) => p.category),
    ),
  ];
  const filtered = useMemo(
    () =>
      products
        .filter(
          (p) =>
            p.gender === gender &&
            (category === "all" || p.category === category) &&
            (source === "all" || p.source === "designer") &&
            p.name.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "popular"
            ? (b.likes || 0) - (a.likes || 0) ||
              (b.createdAt || 0) - (a.createdAt || 0) ||
              a.id.localeCompare(b.id)
            : sort === "newest"
              ? (b.createdAt || 0) - (a.createdAt || 0) ||
                a.id.localeCompare(b.id)
              : a.price - b.price,
        ),
    [products, gender, category, source, query, sort],
  );
  const like = async (p: Product) => {
    setPending(p.id);
    try {
      const result = await api(`/products/${p.id}/like`, {
        liked: !liked.includes(p.id),
      });
      setProducts((prev) =>
        prev.map((v) => (v.id === p.id ? { ...v, likes: result.likes } : v)),
      );
      setLiked((prev) =>
        result.liked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
      );
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setPending(null);
    }
  };
  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE AURA EDIT</p>
          <h2>Shop</h2>
          <p className="muted">
            Discover garments and original designs. Bring your favorites to a
            boutique.
          </p>
        </div>
        <Link className="secondary" to="/studio">
          Create a design <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="shop-controls">
        <Link className="text-link" to="/designs">
          Community & designer access
        </Link>
        <div className="segmented">
          <button
            aria-pressed={gender === "women"}
            onClick={() => navigate("/shopping/women")}
          >
            Women
          </button>
          <button
            aria-pressed={gender === "men"}
            onClick={() => navigate("/shopping/men")}
          >
            Men
          </button>
        </div>
        <label className="field">
          Search
          <input
            type="search"
            placeholder="Find a garment…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="field">
          Show
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All designs</option>
            <option value="designer">Community designers</option>
          </select>
        </label>
        <label className="field">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="popular">Most liked</option>
            <option value="newest">Newest</option>
            <option value="price">Price: low to high</option>
          </select>
        </label>
      </div>
      <div className="category-list" aria-label="Categories">
        {categories.map((c) => (
          <button
            key={c}
            aria-pressed={c === category}
            onClick={() => setCategory(c)}
          >
            {c === "all"
              ? "All"
              : c === "saries"
                ? "Sarees"
                : c === "lehangas"
                  ? "Lehengas"
                  : c === "shirts" && gender === "women"
                    ? "Blouses"
                    : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      {message && (
        <p role="alert" className="notice">
          {message}
        </p>
      )}
      <div className="product-grid">
        {filtered.map((p) => (
          <article className="product-card" key={p.id}>
            <Link to={`/product/${p.id}`} className="product-image">
              <img
                src={catalogImage(p)}
                onError={missingCatalogImage}
                alt={p.name}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              {p.source === "designer" && (
                <span className="product-badge">Community design</span>
              )}
            </Link>
            <div className="product-info">
              <p className="eyebrow">{p.category}</p>
              <Link to={`/product/${p.id}`}>
                <h3>{p.name}</h3>
              </Link>
              <div className="product-price">
                <strong>
                  {p.source === "designer"
                    ? "Made to order"
                    : money(p.price * 100)}
                </strong>
                <button
                  aria-label={`Like ${p.name}`}
                  aria-pressed={liked.includes(p.id)}
                  disabled={pending === p.id || !config.communityReady}
                  onClick={() => like(p)}
                >
                  <Heart
                    size={18}
                    fill={liked.includes(p.id) ? "currentColor" : "none"}
                  />
                  <span>{p.likes || 0}</span>
                </button>
              </div>
              <button
                className="primary"
                disabled={!p.tryOnEnabled || !config.tryOnReady}
                onClick={() => navigate(`/tryon?product=${p.id}`)}
              >
                {p.tryOnEnabled
                  ? `Try on · ${money(config.tryOnPrice)}`
                  : "Try-on unavailable"}
              </button>
              <Link className="secondary" to={`/boutique?product=${p.id}`}>
                Ask a boutique
              </Link>
            </div>
          </article>
        ))}
      </div>
      {filtered.length === 0 && (
        <section className="panel empty-state">
          <h3>No designs here yet</h3>
          <p>Try another collection or publish your own design.</p>
          <Link className="text-link" to="/sketch">
            Open Studio →
          </Link>
        </section>
      )}
      <p className="muted shop-footnote">
        Try-ons require product approval and a separate payment for each
        generation. Published designs become eligible after image review.
      </p>
    </div>
  );
}
