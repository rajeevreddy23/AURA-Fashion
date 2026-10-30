import React, { useState } from "react";
import { auth } from "../firebase";
import { db } from "../database";
import { collection, doc, writeBatch, getDoc } from "firebase/firestore";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database,
} from "lucide-react";
import Papa from "papaparse";
import { motion, AnimatePresence } from "motion/react";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [parsedItems, setParsedItems] = useState<any[]>([]);

  const user = auth.currentUser;

  React.useEffect(() => {
    checkAdmin();
  }, [user]);

  const checkAdmin = async () => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const token = await user.getIdTokenResult();
    setIsAdmin(token.claims.admin === true);
    setLoading(false);
  };

  const RAW_DATA = `Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Variant Fulfillment Service,Variant Price,Variant Compare At Price,Variant Requires Shipping,Variant Taxable,Variant Barcode,Image Src,Image Position,Image Alt Text,Gift Card,SEO Title,SEO Description,Google Shopping / Google Product Category,Google Shopping / Gender,Google Shopping / Age Group,Google Shopping / MPN,Google Shopping / AdWords Grouping,Google Shopping / AdWords Labels,Google Shopping / Condition,Google Shopping / Custom Product,Google Shopping / Custom Label 0,Google Shopping / Custom Label 1,Google Shopping / Custom Label 2,Google Shopping / Custom Label 3,Google Shopping / Custom Label 4,Variant Image,Variant Weight Unit,Variant Tax Code
ocean-blue-shirt,Ocean Blue Shirt,Ocean blue cotton shirt with a narrow collar and buttons down the front and long sleeves. Comfortable fit and tiled kalidoscope patterns. ,partners-demo,,men,true,Title,Default Title,,,,,,0,,1,deny,manual,50,,true,true,,https://burst.shopifycdn.com/photos/young-man-in-bright-fashion_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
classic-varsity-top,Classic Varsity Top,"Womens casual varsity top, This grey and black buttoned top is a sport-inspired piece complete with an embroidered letter. ",partners-demo,,women,true,Size,Small,,,,,,0,,1,deny,manual,60,,true,true,,https://burst.shopifycdn.com/photos/casual-fashion-woman_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
classic-varsity-top,,,,,,,,Medium,,,,,,0,,1,deny,manual,60,,true,true,,,,,,,,,,,,,,,,,,,,,,kg,
classic-varsity-top,,,,,,,,Large,,,,,,0,,1,deny,manual,60,,true,true,,,,,,,,,,,,,,,,,,,,,,kg,
yellow-wool-jumper,Yellow Wool Jumper,Knitted jumper in a soft wool blend with low dropped shoulders and wide sleeves and think cuffs. Perfect for keeping warm during Fall. ,partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,80,,true,true,,https://burst.shopifycdn.com/photos/autumn-photographer-taking-picture_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
floral-white-top,Floral White Top,Stylish sleeveless white top with a floral pattern. ,partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,75,,true,true,,https://burst.shopifycdn.com/photos/city-woman-fashion_925x@2x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
striped-silk-blouse,Striped Silk Blouse,Ultra-stylish black and red striped silk blouse with buckle collar and matching button pants. ,partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,50,,true,true,,https://burst.shopifycdn.com/photos/striped-blouse-fashion_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
classic-leather-jacket,Classic Leather Jacket,"Womans zipped leather jacket. Adjustable belt for a comfortable fit, complete with shoulder pads and front zip pocket. ",partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,80,,true,true,,https://burst.shopifycdn.com/photos/leather-jacket-and-tea_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
dark-denim-top,Dark Denim Top,"Classic dark denim top with chest pockets, long sleeves with buttoned cuffs, and a ripped hem effect.",partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,60,,true,true,,https://burst.shopifycdn.com/photos/young-female-models-denim_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
navy-sport-jacket,Navy Sports Jacket,"Long-sleeved navy waterproof jacket in thin, polyester fabric with a soft mesh inside. The durable water-repellent finish means you'll be kept comfortable and protected when out in all weathers.",partners-demo,,men,true,Title,Default Title,,,,,,0,,1,deny,manual,60,,true,true,,https://burst.shopifycdn.com/photos/mens-fall-fashion-jacket_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
dark-winter-jacket,Soft Winter Jacket,"Thick black winter jacket, with soft fleece lining. Perfect for those cold weather days.",partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,50,,true,true,,https://burst.shopifycdn.com/photos/smiling-woman-on-snowy-afternoon_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
black-leather-bag,Black Leather Bag,"Womens black leather bag, with ample space. Can be worn over the shoulder, or remove straps to carry in your hand. ",partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,30,,true,true,,https://burst.shopifycdn.com/photos/black-bag-over-the-shoulder_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
zipped-jacket,Zipped Jacket,Dark navy and light blue men's zipped waterproof jacket with an outer zipped chestpocket for easy storeage.,partners-demo,,men,true,Title,Default Title,,,,,,0,,1,deny,manual,65,,true,true,,https://burst.shopifycdn.com/photos/menswear-blue-zip-up-jacket_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
silk-summer-top,Silk Summer Top,Silk womens top with short sleeves and number pattern.,partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,70,,true,true,,https://burst.shopifycdn.com/photos/young-hip-woman-at-carnival_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
longsleeve-cotton-top,Long Sleeve Cotton Top,"Black cotton womens top, with long sleeves, no collar and a thick hem. ",partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,50,,true,true,,https://burst.shopifycdn.com/photos/woman-outside-brownstone_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
chequered-red-shirt,Chequered Red Shirt,"Classic mens plaid flannel shirt with long sleeves, in chequered style, with two chest pockets.",partners-demo,,men,true,Title,Default Title,,,,,,0,,1,deny,manual,50,,true,true,,https://burst.shopifycdn.com/photos/red-plaid-shirt_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
white-cotton-shirt,White Cotton Shirt,Plain white cotton long sleeved shirt with loose collar. Small buttons and front pocket. ,partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,30,,true,true,,https://burst.shopifycdn.com/photos/smiling-woman-poses_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
olive-green-jacket,Olive Green Jacket,Loose fitting olive green jacket with buttons and large pockets. Multicoloured pattern on the front of the shoulders.,partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,65,,true,true,,https://burst.shopifycdn.com/photos/urban-fashion_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
blue-silk-tuxedo,Blue Silk Tuxedo,Blue silk tuxedo with marbled aquatic pattern and dark lining. Sleeves are complete with rounded hem and black buttons.,partners-demo,,men,true,Title,Default Title,,,,,,0,,1,deny,manual,70,,true,true,,https://burst.shopifycdn.com/photos/man-adjusts-blue-tuxedo-bowtie_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
red-sports-tee,Red Sports Tee,Women's red sporty t-shirt with colorful details on the sleeves and a small white pocket.,partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,50,,true,true,,https://burst.shopifycdn.com/photos/womens-red-t-shirt_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
striped-skirt-and-top,Striped Skirt and Top,Black cotton top with matching striped skirt. ,partners-demo,,women,true,Title,Default Title,,,,,,0,,1,deny,manual,50,,true,true,,https://burst.shopifycdn.com/photos/woman-in-the-city_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,
led-high-tops,LED High Tops,"Black high top shoes with green LED lights in the sole, tied up with laces and a buckle. ",partners-demo,,men,true,Title,Default Title,,,,,,0,,1,deny,manual,80,,true,true,,https://burst.shopifycdn.com/photos/putting-on-your-shoes_925x.jpg,1,,false,,,,,,,,,,,,,,,,,kg,`;

  const processCSVContent = (content: string) => {
    Papa.parse(content, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const mappedData = results.data.map((item: any, index: number) => {
          // Map Shopify headers or fallback to standard ones
          const id = item.Handle || item.id || `p_${Date.now()}_${index}`;
          const name = item.Title || item.name || "Unknown Product";
          const price = Number(item["Variant Price"] || item.price) || 0;
          const image = item["Image Src"] || item.image || item.imageUrl || "";

          // Auto-category detection for Shopify data
          let category = item.Type || item.category || "misc";
          if (category === "misc" || !category) {
            if (id.includes("shirt")) category = "shirts";
            else if (id.includes("jacket")) category = "blazzers";
            else if (id.includes("top")) category = "tshirts";
            else if (id.includes("bag"))
              category = "watches"; // App uses watches for accessories
            else if (id.includes("shoe")) category = "shoes";
            else if (id.includes("jumper") || id.includes("blouse"))
              category = "shirts";
          }

          let gender = item.Tags || item.gender || "unisex";
          if (gender !== "men" && gender !== "women") gender = "unisex";

          // Strip HTML from description
          const description = (item["Body (HTML)"] || item.description || "")
            .replace(/<[^>]*>?/gm, "")
            .substring(0, 500);

          return {
            id,
            name,
            price,
            image,
            category,
            gender,
            rating: Number(item.rating) || 4.5,
            description,
            updatedAt: new Date().toISOString(),
          };
        });

        // Filter out items without names or images (sometimes Shopify multi-variant rows are empty on these)
        const validItems = mappedData.filter((item) => item.name && item.image);

        // Deduplicate by ID
        const uniqueItems = Array.from(
          new Map(validItems.map((item) => [item.id, item])).values(),
        );

        setParsedItems(uniqueItems);
        setStatus({
          type: "success",
          message: `Parsed ${uniqueItems.length} unique products from data.`,
        });
      },
      error: (error) => {
        setStatus({
          type: "error",
          message: `Error parsing data: ${error.message}`,
        });
      },
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      processCSVContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const loadProvidedData = () => {
    processCSVContent(RAW_DATA);
  };

  const syncToFirestore = async () => {
    if (parsedItems.length === 0) return;
    setUploading(true);
    setStatus(null);

    const batch = writeBatch(db);
    const productsRef = collection(db, "products");

    try {
      parsedItems.forEach((item, index) => {
        // Ensure item has required fields or map them
        const productData = {
          id: item.id || `p_${Date.now()}_${index}`,
          name: item.name || item.title || "Unknown Product",
          price: Number(item.price) || 0,
          image: item.image || item.imageUrl || "",
          category: item.category || "misc",
          gender: item.gender || "unisex",
          rating: Number(item.rating) || 0,
          description: item.description || "",
          updatedAt: new Date().toISOString(),
        };

        const docRef = doc(productsRef, productData.id);
        batch.set(docRef, productData);
      });

      await batch.commit();
      setStatus({
        type: "success",
        message: `Successfully synced ${parsedItems.length} products to Firestore!`,
      });
      setParsedItems([]);
    } catch (error: any) {
      console.error("Sync error:", error);
      setStatus({ type: "error", message: `Sync failed: ${error.message}` });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = "id,name,price,image,category,gender,rating,description\n";
    const example =
      "m1,Example Shirt,1299,https://example.com/img.jpg,shirts,men,4.5,Cool shirt";
    const blob = new Blob([headers + example], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    );

  if (isAdmin === false) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <AlertCircle size={48} className="mx-auto text-red-500" />
        <h1 className="text-2xl font-black">Access Denied</h1>
        <p className="text-gray-500 font-medium">
          You do not have permission to access the admin dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header className="space-y-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase italic">
          Admin Dashboard
        </h1>
        <p className="text-gray-500 font-medium">
          Manage your store inventory and data.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Bulk Upload Section */}
        <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-black text-white rounded-2xl">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Bulk Product Upload
              </h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                Import from CSV
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed font-medium">
              Upload a CSV file to update your product catalog. The file should
              include headers like:
              <code className="bg-gray-100 px-1 rounded text-pink-600 mx-1">
                name, price, image, category, gender
              </code>
              .
            </p>

            <div className="flex flex-col gap-4">
              <button
                onClick={downloadTemplate}
                className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors flex items-center gap-1"
              >
                <FileText size={14} /> Download CSV Template
              </button>

              <label className="relative group cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 group-hover:border-black rounded-3xl p-8 transition-all flex flex-col items-center gap-2">
                  <Database
                    size={32}
                    className="text-gray-300 group-hover:text-black transition-colors"
                  />
                  <span className="text-sm font-bold text-gray-500">
                    Select CSV File
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </label>

              <button
                onClick={loadProvidedData}
                className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 border border-emerald-100"
              >
                <Database size={20} /> Sync Provided Data
              </button>
            </div>

            <AnimatePresence>
              {status && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 rounded-2xl flex items-center gap-3 ${
                    status.type === "success"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : "bg-red-50 text-red-600 border border-red-100"
                  }`}
                >
                  {status.type === "success" ? (
                    <CheckCircle size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                  <span className="text-sm font-bold">{status.message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {parsedItems.length > 0 && (
              <button
                onClick={syncToFirestore}
                disabled={uploading}
                className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Sync to Firestore"
                )}
              </button>
            )}
          </div>
        </section>

        {/* Database Stats Section */}
        <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                System Status
              </h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                Firestore Health
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  Products
                </span>
                <span className="font-bold">Managed</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  Region
                </span>
                <span className="font-bold">Global</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  Auth
                </span>
                <span className="font-bold text-emerald-500 flex items-center gap-1">
                  <CheckCircle size={14} /> Active
                </span>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <p className="text-[10px] font-bold text-amber-700 leading-normal uppercase tracking-wider">
                Note: Syncing will overwrite existing products if they share the
                same ID. IDs are generated automatically if not provided in CSV.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Preview Section */}
      {parsedItems.length > 0 && (
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-black uppercase tracking-widest text-sm">
              JSON Preview ({parsedItems.length} items)
            </h3>
          </div>
          <div className="p-6 max-h-96 overflow-y-auto">
            <pre className="text-[10px] font-mono text-gray-600 bg-gray-50 p-4 rounded-xl">
              {JSON.stringify(parsedItems.slice(0, 5), null, 2)}
              {parsedItems.length > 5 && "\n... more items"}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
