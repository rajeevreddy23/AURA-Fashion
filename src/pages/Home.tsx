import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Sparkles, Shirt, ShoppingBag } from "lucide-react";

const FASHION_IMAGES = [
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80",
  "https://i.pinimg.com/originals/72/b7/8f/72b78f48b101dd4e80fd5ec289917257.jpg",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-eZZzMLL8nIZaJ97-XyjdFIhP4Wpdq7QF6w&s",
  "https://s.yimg.com/ny/api/res/1.2/38YwhaYBd16sTz9BHkyRPA--/YXBwaWQ9aGlnaGxhbmRlcjt3PTEyNDI7aD02OTk7Y2Y9d2VicA--/https://media.zenfs.com/en/reality_tea_694/24c2fa17028a152e9060a3fb0d0cc289",
];

export default function HomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % FASHION_IMAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative h-[500px] rounded-3xl overflow-hidden bg-black group">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentSlide}
            src={FASHION_IMAGES[currentSlide]}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 0.6, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <span className="inline-block px-4 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-widest rounded-full border border-white/30">
              New Collection 2026
            </span>
            <h2 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none">
              ELEVATE YOUR
              <br />
              AURA
            </h2>
            <p className="text-lg text-gray-300 font-medium max-w-md mx-auto">
              Experience the future of fashion with our AI-powered virtual
              try-on technology.
            </p>
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => navigate("/shopping")}
                className="bg-white text-black px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform"
              >
                Shop Now <ShoppingBag size={20} />
              </button>
              <button
                onClick={() =>
                  navigate("/tryon", {
                    state: { product: { image: FASHION_IMAGES[currentSlide] } },
                  })
                }
                className="bg-transparent border border-white text-white px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-white hover:text-black transition-all"
              >
                Virtual TryOn <Sparkles size={20} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Navigation Boxes */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          whileHover={{ y: -5 }}
          onClick={() => navigate("/shopping/men")}
          className="relative h-80 rounded-3xl overflow-hidden cursor-pointer group"
        >
          <img
            src="https://picsum.photos/seed/menbox/800/600"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            alt="Men"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-8 flex flex-col justify-end">
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">
              Mens TryOn
            </h3>
            <p className="text-gray-300 text-sm font-medium mb-4">
              Explore the latest trends in men's fashion.
            </p>
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              Explore Collection <ArrowRight size={18} />
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -5 }}
          onClick={() => navigate("/shopping/women")}
          className="relative h-80 rounded-3xl overflow-hidden cursor-pointer group"
        >
          <img
            src="https://picsum.photos/seed/womenbox/800/600"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            alt="Women"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-8 flex flex-col justify-end">
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">
              Womens TryOn
            </h3>
            <p className="text-gray-300 text-sm font-medium mb-4">
              Discover elegant and stylish women's wear.
            </p>
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              Explore Collection <ArrowRight size={18} />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Animated Slider Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-xl font-black uppercase tracking-tighter">
            Trending Now
          </h4>
          <button
            onClick={() => navigate("/shopping")}
            className="text-sm font-bold text-gray-500 hover:text-black transition-colors"
          >
            View All
          </button>
        </div>
        <div className="flex gap-4 overflow-hidden py-4">
          <motion.div
            animate={{ x: [0, -1000] }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            className="flex gap-4"
          >
            {[...FASHION_IMAGES, ...FASHION_IMAGES].map((img, i) => (
              <div
                key={i}
                onClick={() =>
                  navigate("/tryon", { state: { product: { image: img } } })
                }
                className="w-48 h-64 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer hover:scale-105 transition-transform shadow-lg"
              >
                <img
                  src={img}
                  className="w-full h-full object-cover"
                  alt="Fashion"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
