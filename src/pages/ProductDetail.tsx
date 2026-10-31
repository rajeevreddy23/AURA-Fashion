import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { MEN_PRODUCTS, WOMEN_PRODUCTS } from "../constants";
import { Product } from "../types";
import { api, money, useConfiguration } from "../services/api";
import {
  Star,
  ShoppingCart,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Truck,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import { auth } from "../firebase";
import { db } from "../database";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const config = useConfiguration();

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setProduct(await api<Product>("/products/" + id));
    } catch (err) {
      console.error("Error fetching product:", err);
      // Fallback on error
      const allProducts = [...MEN_PRODUCTS, ...WOMEN_PRODUCTS];
      const found = allProducts.find((p) => p.id === id);
      if (found) setProduct(found);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async () => {
    if (!auth.currentUser || !product) {
      navigate("/login");
      return;
    }
    setAdding(true);
    try {
      await addDoc(collection(db, "users", auth.currentUser.uid, "cart"), {
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1,
        addedAt: serverTimestamp(),
      });
      alert("Added to cart!");
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-black" />
      </div>
    );
  if (!product)
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-black">Product Not Found</h2>
        <button
          onClick={() => navigate("/shopping")}
          className="mt-4 text-gray-500 font-bold hover:text-black"
        >
          Back to Shopping
        </button>
      </div>
    );

  return (
    <div className="space-y-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-black transition-colors"
      >
        <ArrowLeft size={18} /> Back to Shopping
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Product Image */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="aspect-[3/4] rounded-3xl overflow-hidden bg-white shadow-xl"
        >
          <img
            src={product.image}
            className="w-full h-full object-cover"
            alt={product.name}
            referrerPolicy="no-referrer"
          />
        </motion.div>

        {/* Product Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                {product.category}
              </span>
              <div className="flex items-center gap-1 text-sm font-bold">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                {product.rating} · Catalog rating
              </div>
            </div>
            <h1 className="text-5xl font-black tracking-tighter leading-tight">
              {product.name}
            </h1>
            <p className="text-3xl font-black text-black">
              {product.source === "designer"
                ? "Made to order — request a quote"
                : `₹${product.price.toLocaleString()}`}
            </p>
            <p className="text-gray-500 leading-relaxed font-medium">
              {product.description}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 py-6 border-y border-gray-100">
            <div className="flex flex-col items-center gap-2 text-center">
              <ShieldCheck size={24} className="text-gray-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Catalog item
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <Truck size={24} className="text-gray-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Ask for delivery
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <RefreshCcw size={24} className="text-gray-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Ask about returns
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {product.hasPattern && (
              <button
                className="secondary"
                onClick={() => navigate(`/designs?design=${product.id}`)}
              >
                View pattern access & designer permission
              </button>
            )}
            <button
              onClick={addToCart}
              disabled={adding}
              className="flex-1 bg-black text-white px-8 py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              <ShoppingCart size={20} />
              {adding ? "Adding..." : "Add to Cart"}
            </button>
            <button
              onClick={() => navigate("/tryon?product=" + product.id)}
              disabled={!product.tryOnEnabled || !config.tryOnReady}
              className="flex-1 bg-white border-2 border-black text-black px-8 py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black hover:text-white transition-all"
            >
              <Sparkles size={20} />
              {product.tryOnEnabled
                ? "Try on · " + money(config.tryOnPrice)
                : "Try-on unavailable"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
