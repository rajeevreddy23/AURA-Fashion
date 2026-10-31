import React, { useEffect, useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";
import {
  Home,
  ShoppingBag,
  Shirt,
  Palette,
  CreditCard,
  ShoppingCart,
  UserCircle,
  Store,
} from "lucide-react";
import HomePage from "./pages/Home";
const Shopping = lazy(() => import("./pages/Shopping"));
const DesignHub = lazy(() => import("./pages/DesignHub"));
const Atelier = lazy(() => import("./pages/Atelier"));
const Studio = lazy(() => import("./pages/Studio"));
const TryOn = lazy(() => import("./pages/TryOn"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Payment = lazy(() => import("./pages/Payment"));
const Boutique = lazy(() => import("./pages/Boutique"));
const Cart = lazy(() => import("./pages/Cart"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Sketch = lazy(() => import("./pages/Sketch"));
const items = [
  ["/", Home, "Home"],
  ["/shopping", ShoppingBag, "Shop"],
  ["/studio", Palette, "Studio"],
  ["/tryon", Shirt, "Try-on"],
  ["/boutique", Store, "Boutiques"],
  ["/subscription", CreditCard, "Plans"],
  ["/cart", ShoppingCart, "Cart"],
  ["/profile", UserCircle, "Profile"],
] as const;
export default function App() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return (
    <BrowserRouter>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <Link to="/" className="brand">
          <span>
            AURA<span className="brand-dot">.</span>
          </span>
          <small>FASHION, BY YOU</small>
        </Link>
        <div className="header-actions">
          {user ? (
            <>
              <Link to="/profile">{user.displayName || "My account"}</Link>
              <button onClick={() => auth.signOut()}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link
                className="primary small"
                to="/login"
                state={{ mode: "signup" }}
              >
                Join AURA
              </Link>
            </>
          )}
        </div>
      </header>
      <main id="main" className="app-main" key={user?.uid || "guest"}>
        <Suspense fallback={<p role="status">Loading your page…</p>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shopping" element={<Shopping />} />
            <Route path="/shopping/:gender" element={<Shopping />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/studio" element={<Atelier />} />
            <Route path="/designs" element={<DesignHub />} />
            <Route path="/sketch" element={<Studio />} />
            <Route path="/sketch/classic" element={<Sketch />} />
            <Route path="/tryon" element={<TryOn />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/boutique" element={<Boutique />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            <Route
              path="*"
              element={
                <div className="panel">
                  <h2>Page not found</h2>
                  <Link to="/">Return home</Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <nav className="app-nav" aria-label="Main navigation">
        {items.map(([path, Icon, label]) => (
          <NavLink key={path} to={path} end={path === "/"}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </BrowserRouter>
  );
}
