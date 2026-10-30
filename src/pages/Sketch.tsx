import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Palette,
  Sparkles,
  Download,
  Trash2,
  Undo,
  Redo,
  Shirt,
  Eraser,
  PenTool,
  Square,
  Circle,
  Minus,
  User,
  MessageSquare,
  Upload,
  Bird,
  Flower2,
  Star,
  Heart,
  Sun,
  Smile,
  Eye,
  EyeOff,
  LayoutGrid,
  HelpCircle,
  FileUp,
  FileDown,
  RefreshCw,
  Check,
  Info,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { processSketch } from "../services/geminiService";
import { useConfiguration } from "../services/api";

type Tool = "pen" | "eraser" | "line" | "rect" | "circle" | "sticker";

const STICKERS = [
  { icon: Bird, emoji: "🐦", label: "Bird" },
  { icon: Bird, emoji: "🦚", label: "Peacock" },
  { icon: Bird, emoji: "🦢", label: "Swan" },
  { icon: Bird, emoji: "🦜", label: "Parrot" },
  { icon: Bird, emoji: "🕊️", label: "Dove" },
  { icon: Smile, emoji: "🦋", label: "Butterfly" },
  { icon: Flower2, emoji: "🌸", label: "Blossom" },
  { icon: Flower2, emoji: "🌹", label: "Rose" },
  { icon: Flower2, emoji: "🌺", label: "Hibiscus" },
  { icon: Star, emoji: "✨", label: "Sparkle" },
  { icon: Star, emoji: "🌟", label: "Star Glow" },
  { icon: Heart, emoji: "💖", label: "Fancy Heart" },
  { icon: Sun, emoji: "☀️", label: "Sun" },
  { icon: Palette, emoji: "🌈", label: "Rainbow" },
  { icon: Shirt, emoji: "🎀", label: "Ribbon" },
  { icon: Sparkles, emoji: "💎", label: "Gem" },
];

const DRESS_TEMPLATES = [
  {
    id: "t1",
    name: "Shirt",
    icon: Shirt,
    path: "M150,100 L450,100 L450,200 L500,200 L500,400 L400,400 L400,550 L200,550 L200,400 L100,400 L100,200 L150,200 Z",
  },
  {
    id: "t2",
    name: "Saree",
    icon: Shirt,
    path: "M100,100 L500,100 L500,500 L100,500 Z",
  },
  {
    id: "t3",
    name: "Lehanga",
    icon: Shirt,
    path: "M300,100 L100,500 L500,500 Z",
  },
];

const COLOR_PRESETS = [
  { name: "Midnight Black", value: "#000000" },
  { name: "Slate Gray", value: "#64748b" },
  { name: "Crimson Red", value: "#dc2626" },
  { name: "Sunset Orange", value: "#ea580c" },
  { name: "Golden Yellow", value: "#ca8a04" },
  { name: "Emerald Green", value: "#16a34a" },
  { name: "Royal Blue", value: "#2563eb" },
  { name: "Fancy Pink", value: "#db2777" },
  { name: "Violet Silk", value: "#7c3aed" },
  { name: "Warm Beige", value: "#d97706" },
];

const PROCESSING_STEPS = [
  "Scanning hand-drawn brush contours...",
  "Denoising outlines & details...",
  "Interpreting design specifications...",
  "Stitching luxury fabric drapes...",
  "Applying lighting and 3D shadows...",
];

export default function SketchPage() {
  const configuration = useConfiguration();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sketchUploadInputRef = useRef<HTMLInputElement>(null);
  const userUploadRef = useRef<HTMLDivElement>(null);

  // Drawing States
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [selectedSticker, setSelectedSticker] = useState(STICKERS[0].emoji);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(6);
  const [selectedTemplate, setSelectedTemplate] = useState(DRESS_TEMPLATES[0]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);

  // Advanced Canvas Helper States
  const [showGrid, setShowGrid] = useState(true);
  const [showTemplate, setShowTemplate] = useState(true);
  const [templateOpacity, setTemplateOpacity] = useState(0.45);
  const [includeTemplateInRender, setIncludeTemplateInRender] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // AI & Input States
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);

  // AI Processing steps animator loop
  useEffect(() => {
    let interval: any;
    if (processing) {
      setProcessingStep(0);
      interval = setInterval(() => {
        setProcessingStep((prev) => (prev + 1) % PROCESSING_STEPS.length);
      }, 2200);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [processing]);

  // Keyboard Shortcuts (Undo / Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, historyStep]);

  // Init canvas transparent once
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Transparent base so overlay guides show from behind
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;

    // Save initial blank state
    const dataUrl = canvas.toDataURL();
    setHistory([dataUrl]);
    setHistoryStep(0);
  };

  useEffect(() => {
    initCanvas();
  }, []);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(dataUrl);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prevStep = historyStep - 1;
    const img = new Image();
    img.src = history[prevStep];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setHistoryStep(prevStep);
    };
  };

  const redo = () => {
    if (historyStep >= history.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nextStep = historyStep + 1;
    const img = new Image();
    img.src = history[nextStep];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setHistoryStep(nextStep);
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    setIsDrawing(true);
    setStartPos({ x, y });
    setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));

    if (tool === "pen" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (tool === "sticker") {
      ctx.font = `${brushSize * 4}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(selectedSticker, x, y);
      setIsDrawing(false); // stamp once
      saveToHistory();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.globalCompositeOperation = "source-over"; // reset always
        ctx.beginPath();
      }
    }
    saveToHistory();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = brushSize;

    if (tool === "pen" || tool === "eraser") {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      // Shape previewing
      if (snapshot) {
        ctx.putImageData(snapshot, 0, 0);
      }
      ctx.beginPath();
      if (tool === "line") {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(x, y);
      } else if (tool === "rect") {
        ctx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
      } else if (tool === "circle") {
        const radius = Math.sqrt(
          Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2),
        );
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
      }
      ctx.stroke();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setResultImage(null);
    setError(null);
    saveToHistory();
  };

  // Compose drawing with templates & white background correctly
  const getCompositedSketchBase64 = () => {
    const canvas = canvasRef.current;
    if (!canvas) return "";

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return canvas.toDataURL("image/png");

    // Solid white background for the AI model
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // If selected, bake the template outline into the AI submission to guide the AI
    if (showTemplate && includeTemplateInRender) {
      tempCtx.strokeStyle = "#cccccc";
      tempCtx.lineWidth = 3;
      const p = new Path2D(selectedTemplate.path);
      tempCtx.stroke(p);
    }

    // Draw hand-drawn client strokes
    tempCtx.drawImage(canvas, 0, 0);
    return tempCanvas.toDataURL("image/png");
  };

  const handleGenerate = async () => {
    const base64Data = getCompositedSketchBase64();
    if (!base64Data) return;

    setProcessing(true);
    setError(null);
    try {
      const result = await processSketch(
        base64Data,
        selectedTemplate.name,
        userImage,
        instructions,
      );
      setResultImage(result);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Please use the paid AI render in the new Studio.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleTryOnResult = () => {
    if (resultImage) {
      navigate("/tryon", {
        state: { product: { image: resultImage }, userImage: userImage },
      });
    }
  };

  const onDropUser = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => setUserImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const { getRootProps: getUserProps, getInputProps: getUserInput } =
    useDropzone({
      onDrop: onDropUser,
      accept: { "image/*": [] },
      multiple: false,
    } as any);

  // Upload custom drawing file to canvas
  const handleUploadSketch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fit to canvas keeping aspect ratio
        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.min(hRatio, vRatio);
        const shiftX = (canvas.width - img.width * ratio) / 2;
        const shiftY = (canvas.height - img.height * ratio) / 2;

        ctx.drawImage(
          img,
          0,
          0,
          img.width,
          img.height,
          shiftX,
          shiftY,
          img.width * ratio,
          img.height * ratio,
        );
        saveToHistory();
      };
    };
    reader.readAsDataURL(file);
  };

  // Download raw hand-drawn sketch (transparent PNG)
  const downloadSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `aura-sketch-${selectedTemplate.name.toLowerCase()}.png`;
    link.click();
  };

  // Motion variants
  const staggerContainer = {
    animate: { transition: { staggerChildren: 0.08 } },
  };

  const cardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 100 },
    },
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-2">
      {/* Title section with subtle entry animation */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <span className="text-emerald-500 font-extrabold uppercase tracking-widest text-[11px] bg-emerald-50 px-3 py-1 rounded-full">
          Creative Suite
        </span>
        <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
          AI Fashion Sketcher
        </h2>
        <p className="text-gray-500 font-medium max-w-xl mx-auto">
          Draw or import a sketch, then continue to a separately paid AI render.
          Personal-photo try-ons use approved Shop products.
        </p>
      </motion.div>

      {/* Main Grid container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* SIDEBAR: Configuration & Uploads */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="lg:col-span-1 space-y-6"
        >
          {/* Section 1: Template guidelines */}
          <motion.div
            variants={cardVariants}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4"
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center justify-between">
              <span>1. Base Blueprint</span>
              <Shirt size={14} className="text-gray-400" />
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {DRESS_TEMPLATES.map((t) => (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className={`p-3.5 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    selectedTemplate.id === t.id
                      ? "border-black bg-black text-white shadow-md"
                      : "border-gray-100 bg-white text-gray-500 hover:border-gray-300 hover:text-black"
                  }`}
                >
                  <t.icon size={18} />
                  <span className="font-bold text-xs uppercase tracking-wider">
                    {t.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Section 2: Advanced Canvas View Settings */}
          <motion.div
            variants={cardVariants}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4"
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center justify-between">
              <span>2. Grid & Guides</span>
              <LayoutGrid size={14} className="text-gray-400" />
            </h3>

            <div className="space-y-3.5 text-xs font-bold text-gray-600">
              {/* Show/Hide Grid */}
              <label className="flex items-center justify-between cursor-pointer py-1 select-none">
                <span className="flex items-center gap-2 text-gray-500">
                  <LayoutGrid size={15} /> Show Layout Grid
                </span>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-black cursor-pointer"
                />
              </label>

              {/* Show/Hide Outline Template */}
              <label className="flex items-center justify-between cursor-pointer py-1 select-none">
                <span className="flex items-center gap-2 text-gray-500">
                  {showTemplate ? <Eye size={15} /> : <EyeOff size={15} />} Show
                  Base Guide
                </span>
                <input
                  type="checkbox"
                  checked={showTemplate}
                  onChange={(e) => setShowTemplate(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-black cursor-pointer"
                />
              </label>

              {/* Template Opacity Slider */}
              {showTemplate && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-1.5 pt-1.5 border-t border-gray-50"
                >
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>GUIDE OPACITY</span>
                    <span>{Math.round(templateOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={templateOpacity}
                    onChange={(e) =>
                      setTemplateOpacity(parseFloat(e.target.value))
                    }
                    className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black"
                  />
                </motion.div>
              )}

              {/* Include template in AI render */}
              <label className="flex items-center justify-between cursor-pointer py-1.5 border-t border-gray-50 select-none">
                <span className="flex items-center gap-1.5 text-gray-500">
                  <Check size={14} className="text-emerald-500" /> Guide Outline
                  to AI
                </span>
                <input
                  type="checkbox"
                  checked={includeTemplateInRender}
                  onChange={(e) => setIncludeTemplateInRender(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-black cursor-pointer"
                />
              </label>
            </div>
          </motion.div>

          {/* Section 3: Optional Try-On Model Photo */}
          <motion.div
            variants={cardVariants}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4"
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center justify-between">
              <span>3. Model Try-On (Optional)</span>
              <User size={14} className="text-gray-400" />
            </h3>
            <div
              {...getUserProps()}
              ref={userUploadRef}
              className={`aspect-[3/4] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-3 cursor-pointer overflow-hidden bg-gray-50 ${
                userImage
                  ? "border-black"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <input {...getUserInput()} />
              {userImage ? (
                <div className="relative w-full h-full group">
                  <img
                    src={userImage}
                    className="w-full h-full object-cover rounded-lg"
                    alt="User Model"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] text-white font-extrabold uppercase tracking-wider bg-black/60 px-2 py-1 rounded">
                      Change Photo
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserImage(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-white rounded-full text-red-500 shadow-sm hover:scale-110 transition-transform"
                    title="Remove Photo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-1.5 p-2">
                  <Upload size={20} className="text-gray-400 mx-auto" />
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-wide">
                    Upload Model Photo
                  </p>
                  <p className="text-[9px] text-gray-400 font-medium">
                    To see yourself wearing the design later
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Section 4: Design instructions */}
          <motion.div
            variants={cardVariants}
            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4"
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center justify-between">
              <span>4. AI Styling Rules</span>
              <MessageSquare size={14} className="text-gray-400" />
            </h3>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Specify fabric (e.g., velvet, satin), premium patterns (floral, gold zari), button styles, cuts..."
              className="w-full h-24 p-3 rounded-xl border border-gray-200 focus:border-black outline-none text-xs leading-relaxed transition-all resize-none font-medium"
            />
          </motion.div>
        </motion.div>

        {/* CENTER COLUMN: Drawing Canvas Area */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
          >
            {/* TOOLBAR CONTROLS */}
            <div className="bg-gray-50/70 backdrop-blur p-4 border-b border-gray-100 flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Left controls: drawing elements */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setTool("pen")}
                    title="Pen Brush"
                    className={`p-2 rounded-xl transition-all ${tool === "pen" ? "bg-black text-white shadow-sm" : "text-gray-400 hover:bg-gray-200 hover:text-black"}`}
                  >
                    <PenTool size={16} />
                  </button>
                  <button
                    onClick={() => setTool("eraser")}
                    title="Eraser"
                    className={`p-2 rounded-xl transition-all ${tool === "eraser" ? "bg-black text-white shadow-sm" : "text-gray-400 hover:bg-gray-200 hover:text-black"}`}
                  >
                    <Eraser size={16} />
                  </button>

                  <div className="w-px h-5 bg-gray-200 mx-0.5" />

                  <button
                    onClick={() => setTool("line")}
                    title="Draw Straight Line"
                    className={`p-2 rounded-xl transition-all ${tool === "line" ? "bg-black text-white shadow-sm" : "text-gray-400 hover:bg-gray-200 hover:text-black"}`}
                  >
                    <Minus size={16} />
                  </button>
                  <button
                    onClick={() => setTool("rect")}
                    title="Draw Rectangle"
                    className={`p-2 rounded-xl transition-all ${tool === "rect" ? "bg-black text-white shadow-sm" : "text-gray-400 hover:bg-gray-200 hover:text-black"}`}
                  >
                    <Square size={16} />
                  </button>
                  <button
                    onClick={() => setTool("circle")}
                    title="Draw Circle"
                    className={`p-2 rounded-xl transition-all ${tool === "circle" ? "bg-black text-white shadow-sm" : "text-gray-400 hover:bg-gray-200 hover:text-black"}`}
                  >
                    <Circle size={16} />
                  </button>

                  <div className="w-px h-5 bg-gray-200 mx-0.5" />

                  {/* Stamp Tool presets */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200">
                    {STICKERS.slice(0, 8).map((s) => (
                      <button
                        key={s.emoji}
                        onClick={() => {
                          setTool("sticker");
                          setSelectedSticker(s.emoji);
                        }}
                        title={`Stamp: ${s.label}`}
                        className={`p-1.5 text-sm rounded-lg transition-all ${tool === "sticker" && selectedSticker === s.emoji ? "bg-black text-white" : "hover:bg-gray-100"}`}
                      >
                        <span>{s.emoji}</span>
                      </button>
                    ))}
                    {STICKERS.length > 8 && (
                      <select
                        onChange={(e) => {
                          setTool("sticker");
                          setSelectedSticker(e.target.value);
                        }}
                        value={
                          tool === "sticker" &&
                          STICKERS.slice(8).some(
                            (s) => s.emoji === selectedSticker,
                          )
                            ? selectedSticker
                            : ""
                        }
                        className="p-1 text-xs bg-transparent border-none outline-none font-bold cursor-pointer max-w-[45px] text-gray-500"
                        title="More stamp emojis"
                      >
                        <option value="" disabled>
                          More
                        </option>
                        {STICKERS.slice(8).map((s) => (
                          <option key={s.emoji} value={s.emoji}>
                            {s.emoji} {s.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Right controls: general utilities */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={undo}
                    disabled={historyStep <= 0}
                    title="Undo (Ctrl+Z)"
                    className="p-2 text-gray-400 hover:text-black disabled:opacity-20 transition-all rounded-lg hover:bg-gray-200"
                  >
                    <Undo size={16} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={historyStep >= history.length - 1}
                    title="Redo (Ctrl+Y)"
                    className="p-2 text-gray-400 hover:text-black disabled:opacity-20 transition-all rounded-lg hover:bg-gray-200"
                  >
                    <Redo size={16} />
                  </button>

                  <div className="w-px h-5 bg-gray-200 mx-0.5" />

                  <button
                    onClick={() => setShowHelp(!showHelp)}
                    title="Show Canvas Shortcuts & Help"
                    className={`p-2 rounded-lg transition-all ${showHelp ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-200 hover:text-black"}`}
                  >
                    <HelpCircle size={16} />
                  </button>
                  <button
                    onClick={() => sketchUploadInputRef.current?.click()}
                    title="Upload existing sketch/image file onto canvas"
                    className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-all"
                  >
                    <FileUp size={16} />
                  </button>
                  <input
                    type="file"
                    ref={sketchUploadInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleUploadSketch}
                  />
                  <button
                    onClick={downloadSketch}
                    title="Download current hand-drawn sketch"
                    className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-all"
                  >
                    <FileDown size={16} />
                  </button>
                  <button
                    onClick={clearCanvas}
                    title="Clear drawing canvas"
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Dynamic Swatches & Brush options */}
              <div className="flex flex-col md:flex-row gap-4 items-stretch justify-between pt-1 border-t border-gray-100">
                {/* Swatches row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1.5">
                    Colors
                  </span>
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => {
                        setColor(preset.value);
                        if (tool === "eraser") setTool("pen");
                      }}
                      className="w-5.5 h-5.5 rounded-full border-2 transition-transform hover:scale-115 relative flex items-center justify-center cursor-pointer shadow-sm"
                      style={{
                        backgroundColor: preset.value,
                        borderColor:
                          color === preset.value
                            ? "#3b82f6"
                            : "rgba(0,0,0,0.1)",
                      }}
                      title={preset.name}
                    >
                      {color === preset.value && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white mix-blend-difference" />
                      )}
                    </button>
                  ))}

                  {/* Native Color Picker */}
                  <div className="relative w-7 h-7 rounded-full overflow-hidden border border-gray-200 cursor-pointer flex items-center justify-center hover:scale-110 transition-transform">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        if (tool === "eraser") setTool("pen");
                      }}
                      className="absolute inset-0 w-[150%] h-[150%] -translate-x-[15%] -translate-y-[15%] cursor-pointer border-none bg-transparent"
                      title="Custom color"
                    />
                    <Palette
                      size={13}
                      className="text-gray-400 pointer-events-none mix-blend-difference"
                    />
                  </div>
                </div>

                {/* Brush size slider with live brush size circle tooltip indicator */}
                <div className="flex items-center gap-3.5 flex-1 max-w-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 min-w-[55px]">
                    Size: {brushSize}px
                  </span>
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      type="range"
                      min="2"
                      max="45"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                    />
                    {/* Live indicator circle */}
                    <div className="w-8 h-8 rounded border border-gray-100 bg-white flex items-center justify-center shadow-sm">
                      <div
                        className="rounded-full"
                        style={{
                          width: `${Math.max(2, Math.min(24, brushSize))}px`,
                          height: `${Math.max(2, Math.min(24, brushSize))}px`,
                          backgroundColor:
                            tool === "eraser" ? "#cbd5e1" : color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts Help Collapsible Banner */}
            <AnimatePresence>
              {showHelp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-blue-50/50 p-4 border-b border-gray-100 text-xs font-semibold text-blue-800 space-y-1.5"
                >
                  <p className="font-bold flex items-center gap-1.5 text-blue-900">
                    <Info size={14} /> Drawing Studio Keyboard Shortcuts:
                  </p>
                  <div className="grid grid-cols-2 gap-3 pl-5 text-blue-700/90 leading-tight">
                    <div>
                      ⌨️{" "}
                      <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-sm text-[10px] font-mono">
                        Ctrl + Z
                      </kbd>{" "}
                      : Undo stroke
                    </div>
                    <div>
                      ⌨️{" "}
                      <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-sm text-[10px] font-mono">
                        Ctrl + Y
                      </kbd>{" "}
                      : Redo stroke
                    </div>
                    <div>
                      🖱️{" "}
                      <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-sm text-[10px] font-mono">
                        Drag
                      </kbd>{" "}
                      : Draw paths or shapes
                    </div>
                    <div>
                      🎯{" "}
                      <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-sm text-[10px] font-mono">
                        Click
                      </kbd>{" "}
                      : Stamp emoji stickers
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CANVAS INTERFACE */}
            <div className="relative aspect-square bg-white cursor-crosshair overflow-hidden border-b border-gray-100 select-none">
              {/* LAYERS UNDERNEATH THE DRAWING CANVAS */}

              {/* Layer 1: Layout Grid */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-300"
                  style={{
                    backgroundImage:
                      "radial-gradient(#d1d5db 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                  }}
                />
              )}

              {/* Layer 2: Template Guideline Path */}
              {showTemplate && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-300"
                  viewBox="0 0 600 600"
                  style={{ opacity: templateOpacity }}
                >
                  <path
                    d={selectedTemplate.path}
                    fill="none"
                    stroke="#475569"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="6,8"
                  />
                </svg>
              )}

              {/* Layer 3: Interactive Drawing Canvas */}
              <canvas
                ref={canvasRef}
                width={600}
                height={600}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-full absolute inset-0 z-10"
              />
            </div>
          </motion.div>

          {/* RENDER TRIGGERS WITH GLOW EFFECTS */}
          <div className="relative">
            <button
              onClick={handleGenerate}
              disabled={processing}
              className="w-full bg-black hover:bg-gray-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all disabled:opacity-50 shadow-xl relative overflow-hidden group"
            >
              {processing ? (
                <>
                  <RefreshCw
                    className="animate-spin text-emerald-400"
                    size={20}
                  />
                  <span className="animate-pulse">
                    {PROCESSING_STEPS[processingStep]}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles
                    className="text-yellow-400 group-hover:animate-bounce"
                    size={20}
                  />
                  <span>Continue to paid AI render</span>
                </>
              )}
            </button>
            {!processing && (
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-2xl blur opacity-15 pointer-events-none -z-10 animate-pulse" />
            )}
          </div>

          {/* Show clear error banner if generation fails */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />
                <p className="text-xs text-red-700 font-semibold leading-relaxed">
                  {error}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: AI Generation Mockup Output */}
        <motion.div
          initial={{ opacity: 0, x: 25 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-1 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
              AI Fashion Design
            </h3>
            {resultImage && (
              <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                Rendered
              </span>
            )}
          </div>

          {/* Output Display box */}
          <div className="aspect-square rounded-3xl border border-gray-100 shadow-sm bg-white overflow-hidden flex items-center justify-center relative group">
            {resultImage ? (
              <div className="w-full h-full relative overflow-hidden">
                <img
                  src={resultImage}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                  alt="AI Haute Couture Result"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all flex items-end p-5">
                  <p className="text-white text-[10px] font-bold uppercase tracking-widest">
                    Aura AI Generated Concept
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 space-y-4">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-1 border border-gray-100">
                  <Palette className="text-gray-300" size={24} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Awaiting Rendering...
                  </p>
                  <p className="text-[10px] text-gray-300 uppercase leading-relaxed font-semibold">
                    Draw your concept, choose guide overlays, and click detect &
                    render
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons once rendered */}
          <AnimatePresence>
            {resultImage && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="space-y-3 pt-2"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTryOnResult}
                  className="w-full bg-emerald-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-md relative"
                >
                  <User size={16} />
                  <span>Virtual Try On This Design</span>
                  <div className="absolute right-4 w-2 h-2 rounded-full bg-white animate-ping" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = resultImage;
                    link.download = `aura-fashion-${selectedTemplate.name.toLowerCase()}.png`;
                    link.click();
                  }}
                  className="w-full bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-850 transition-all shadow-md"
                >
                  <Download size={16} />
                  <span>Download Concept Image</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setResultImage(null)}
                  className="w-full bg-white border border-gray-200 text-gray-400 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:border-gray-300 hover:text-gray-600 transition-all"
                >
                  <Undo size={16} />
                  <span>Start New Design</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
