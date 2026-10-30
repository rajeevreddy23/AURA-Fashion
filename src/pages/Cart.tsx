import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { db } from "../database";
import {
  collection,
  query,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingCart,
  Trash2,
  CreditCard,
  Package,
  History,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CartPage() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"cart" | "history">("cart");

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      try {
        // Fetch Cart
        const cartSnap = await getDocs(
          collection(db, "users", auth.currentUser.uid, "cart"),
        );
        setCartItems(cartSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // Fetch Orders
        const ordersSnap = await getDocs(
          query(
            collection(db, "users", auth.currentUser.uid, "orders"),
            orderBy("createdAt", "desc"),
          ),
        );
        setOrders(ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        setError(
          "Your cart could not be loaded. Please refresh or try again later.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const removeFromCart = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "cart", id));
      setCartItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      setError("This item could not be removed. Please try again.");
    }
  };

  const checkout = async () => {
    alert(
      "Garment checkout is not configured. No order or payment has been created.",
    );
  };

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  if (loading) return <p role="status">Loading your cart…</p>;
  if (!auth.currentUser)
    return (
      <section className="panel empty-state">
        <h2>Your cart</h2>
        <p>Please log in to view your saved items.</p>
        <button className="primary" onClick={() => navigate("/login")}>
          Log in
        </button>
      </section>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <p className="notice">
        Garment checkout is awaiting merchant setup. No physical garment order
        can be placed yet. Try-on payments are managed separately through the
        Shop.
      </p>
      <div className="flex bg-gray-100 p-1 rounded-2xl w-fit mx-auto">
        <button
          onClick={() => setActiveTab("cart")}
          className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "cart" ? "bg-white shadow-sm text-black" : "text-gray-500"}`}
        >
          <ShoppingCart size={18} /> My Cart ({cartItems.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "history" ? "bg-white shadow-sm text-black" : "text-gray-500"}`}
        >
          <History size={18} /> Order History
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "cart" ? (
          <motion.div
            key="cart"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {cartItems.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 space-y-4">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                  <ShoppingBag className="text-gray-300" size={40} />
                </div>
                <h3 className="text-xl font-bold">Your cart is empty</h3>
                <button
                  onClick={() => navigate("/shopping")}
                  className="text-black font-bold underline"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-2xl border border-gray-100 flex gap-4 items-center"
                    >
                      <img
                        src={item.image}
                        className="w-20 h-24 object-cover rounded-xl"
                        alt={item.name}
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1">
                        <h4 className="font-bold text-black">{item.name}</h4>
                        <p className="text-sm font-black text-gray-500">
                          ₹{item.price.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="lg:col-span-1">
                  <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6 sticky top-24">
                    <h3 className="text-xl font-black uppercase tracking-tighter">
                      Order Summary
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium text-gray-500">
                        <span>Subtotal</span>
                        <span>₹{totalAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium text-gray-500">
                        <span>Shipping</span>
                        <span className="text-green-500">FREE</span>
                      </div>
                      <div className="pt-4 border-t border-gray-100 flex justify-between items-end">
                        <span className="text-sm font-bold uppercase tracking-wider">
                          Total
                        </span>
                        <span className="text-2xl font-black">
                          ₹{totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={checkout}
                      disabled
                      className="w-full bg-black text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-800 transition-all shadow-xl"
                    >
                      <CreditCard size={20} /> Garment checkout unavailable
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {orders.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 space-y-4">
                <Package className="text-gray-200 mx-auto" size={64} />
                <h3 className="text-xl font-bold text-gray-400">
                  No orders yet
                </h3>
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white p-6 rounded-3xl border border-gray-100 space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Order ID: {order.id.slice(0, 8)}
                      </p>
                      <p className="text-sm font-bold">
                        {new Date(
                          order.createdAt?.seconds * 1000 || order.createdAt,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                      {order.status}
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {order.items.map((item: any, i: number) => (
                      <img
                        key={i}
                        src={item.image}
                        className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                        alt={item.name}
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  </div>
                  <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-500">
                      {order.items.length} Items
                    </span>
                    <span className="text-lg font-black">
                      ₹{order.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
