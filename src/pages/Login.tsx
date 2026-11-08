import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { db } from "../database";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { motion } from "motion/react";
import {
  Mail,
  Lock,
  User,
  Phone,
  LogIn,
  UserPlus,
  ArrowRight,
} from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const state = location.state as { mode?: "login" | "signup" };
    if (state?.mode === "signup") {
      setIsLogin(false);
    } else if (state?.mode === "login") {
      setIsLogin(true);
    }
  }, [location.state]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const { user } = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await updateProfile(user, { displayName: name || email.split("@")[0] });

        // Create user doc
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: name || email.split("@")[0],
          createdAt: new Date().toISOString(),
        });
      }
      try {
        const guest = localStorage.getItem("aura-design-v1:guest");
        const key = "aura-design-v1:" + auth.currentUser?.uid;
        if (guest && !localStorage.getItem(key))
          localStorage.setItem(key, guest);
      } catch {}
      navigate(location.state?.returnTo || "/");
    } catch (err: any) {
      console.error("Login error:", err);
      let message = "An error occurred. Please try again.";
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        message = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        message = "This email is already registered. Please login instead.";
      } else if (err.code === "auth/weak-password") {
        message = "Password should be at least 6 characters.";
      } else if (err.code === "auth/operation-not-allowed") {
        message =
          "Email/Password login is not enabled in your Firebase Console. Please enable it or use Google Login.";
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
        });
      }
      try {
        const guest = localStorage.getItem("aura-design-v1:guest");
        const key = "aura-design-v1:" + auth.currentUser?.uid;
        if (guest && !localStorage.getItem(key))
          localStorage.setItem(key, guest);
      } catch {}
      navigate(location.state?.returnTo || "/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aura-auth max-w-md mx-auto py-12">
      <div className="auth-editorial">
        <span>AURA ATELIER</span>
        <h1>
          A world of
          <br />
          <em>your own design.</em>
        </h1>
        <p>
          Keep your ideas, discover your style, and bring your next look to
          life.
        </p>
        <small>AI-created bridal inspiration</small>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-gray-100 space-y-8"
      >
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black tracking-tighter uppercase">
            {isLogin ? "Welcome Back" : "Join Aura"}
          </h2>
          <p className="text-gray-500 font-medium">
            {isLogin
              ? "Login to your fashion world"
              : "Create your fashion aura today"}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                aria-label="Full name"
                autoComplete="name"
                placeholder="Full Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:bg-white focus:border-black transition-all outline-none"
              />
            </div>
          )}
          <div className="relative">
            <Mail
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="email"
              aria-label="Email address"
              autoComplete="email"
              placeholder="Email Address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:bg-white focus:border-black transition-all outline-none"
            />
          </div>
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="password"
              aria-label="Password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:bg-white focus:border-black transition-all outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:bg-gray-800 transition-all disabled:opacity-50 shadow-xl"
          >
            {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? "Processing..." : isLogin ? "Login" : "Sign Up"}
          </button>
        </form>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-white px-4">
            Or continue with
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border-2 border-gray-100 text-black py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:border-black transition-all"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            className="w-5 h-5"
            alt="Google"
          />
          Google
        </button>

        <div className="text-center pt-4">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-bold text-gray-500 hover:text-black transition-colors flex items-center gap-2 mx-auto"
          >
            {isLogin
              ? "Don't have an account? Sign Up"
              : "Already have an account? Login"}
            <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
