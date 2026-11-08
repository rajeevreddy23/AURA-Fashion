import { Link, NavLink, useSearchParams, useNavigate } from "react-router-dom";
import {
  Box,
  Crown,
  Diamond,
  FileText,
  FolderOpen,
  Heart,
  Home,
  Layers,
  Palette,
  Ruler,
  Scissors,
  Search,
  Settings2,
  Sparkles,
  Store,
  UserCircle,
} from "lucide-react";
import type { User } from "firebase/auth";
const tools = [
  ["projects", FolderOpen, "My Designs"],
  ["assistant", Sparkles, "AI Assistant"],
  ["materials", Palette, "Fabrics & Materials"],
  ["trims", Scissors, "Trims & Embellishments"],
  ["components", Layers, "Pattern Library"],
  ["measurements", Ruler, "Avatar & Fit"],
  ["simulation", Settings2, "Cloth Simulation"],
  ["techpack", FileText, "Tech Pack"],
  ["costing", Diamond, "Costing & BOM"],
] as const;
export default function StudioChrome({ user }: { user: User | null }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const selected = params.get("tool");
  return (
    <>
      <header className="reference-header">
        <Link to="/" className="reference-brand">
          <span className="dress-mark" aria-hidden="true">
            <svg viewBox="0 0 34 44" width="30" height="38">
              <path
                d="M11 2L13 13 9 20 2 40Q17 46 32 40L25 20 21 13 23 2 20 1 17 10 14 1Z"
                fill="#be174c"
              />
              <path
                d="M13 14H21M6 36Q17 40 28 36M14 20L10 39M20 20L24 39"
                fill="none"
                stroke="#f49aae"
                strokeWidth="1.3"
              />
            </svg>
          </span>
          <span>
            AURA<small>Fashion</small>
          </span>
        </Link>
        <nav
          aria-label="Studio workspace navigation"
          className="reference-top-tabs"
        >
          <Link className="selected" to="/studio">
            Studio
          </Link>
          <Link to="/modeling">AI 3D Modeling</Link>
          <Link to="/looks">Dress Library</Link>
          <Link to="/studio?tool=materials">Fabrics</Link>
          <Link to="/studio?tool=assistant">Render</Link>
          <Link to="/studio?tool=techpack">Tech Pack</Link>
          <Link to="/studio?tool=costing">Costing</Link>
          <Link to="/boutique">Boutiques</Link>
          <Link to="/shopping">Explore</Link>
        </nav>
        <form
          className="reference-search"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            navigate(
              `/shopping?q=${encodeURIComponent(String(data.get("q") || ""))}`,
            );
          }}
        >
          <Search size={16} />
          <input
            aria-label="Search the collection"
            name="q"
            placeholder="Search the fashion collection…"
          />
        </form>
        <Link className="reference-account" to="/subscription">
          <Diamond size={21} />
          <span>
            Publishing<small>View plans</small>
          </span>
        </Link>
        <Link
          className="reference-profile"
          to={user ? "/profile" : "/login"}
          aria-label={user ? "My profile" : "Log in"}
        >
          <UserCircle size={28} />
        </Link>
      </header>
      <nav className="reference-rail" aria-label="Main navigation">
        <NavLink to="/">
          <Home size={17} />
          Home
        </NavLink>
        <NavLink to="/looks">
          <Layers size={17} />
          Dress designs
        </NavLink>
        <NavLink to="/modeling">
          <Box size={17} />
          AI 3D Modeling
        </NavLink>
        <NavLink to="/studio" className="selected">
          <Box size={18} />
          3D Studio
        </NavLink>
        {tools.map(([id, Icon, label]) => (
          <Link
            key={id}
            className={selected === id ? "active-tool" : ""}
            to={`/studio?tool=${id}`}
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        ))}
        <NavLink to="/boutique">
          <Store size={17} />
          Boutique Share
        </NavLink>
        <NavLink to="/designs">
          <Heart size={17} />
          Community
        </NavLink>
        <NavLink to="/profile">
          <UserCircle size={17} />
          Account
        </NavLink>
        <Link className="reference-premium" to="/subscription">
          <Crown size={25} />
          <strong>For your next creation</strong>
          <span>Explore publishing plans</span>
          <b>View plans →</b>
        </Link>
      </nav>
    </>
  );
}
