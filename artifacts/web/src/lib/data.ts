import { API_BASE_URL } from "./config";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  badge?: "new" | "sale" | "hot";
  inStock: boolean;
  isFast?: boolean;
  description: string;
  specs: Record<string, string>;
  colors?: string[];
  storage?: string[];
}

export interface SubCategory {
  id: string;
  numericId: number;
  name: string;
  productCount: number;
}

export interface Category {
  id: string;       // slug — used for routing /categories/[id]
  numericId: number; // API numeric ID — used for filtering
  name: string;
  icon: string;
  subcategories: string[];
  children: SubCategory[];
  productCount: number;
  parentId: number | null;
}

export interface SearchResult {
  products: Product[];
  total: number;
  totalPages: number;
}

export interface Banner {
  id: number;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  position: number;
  isActive: boolean;
}

// ── Static fallback data (used by "use client" components and on API failure) ──

export const categories: Category[] = [
  { id: "electronics", numericId: 0, name: "Electronics", icon: "💻", subcategories: ["Mobiles & Tablets", "Laptops", "TV & Audio", "Cameras"], children: [], productCount: 1240, parentId: null },
  { id: "fashion", numericId: 0, name: "Fashion", icon: "👗", subcategories: ["Men's Fashion", "Women's Fashion", "Kids Fashion", "Footwear"], children: [], productCount: 3200, parentId: null },
  { id: "home", numericId: 0, name: "Home & Living", icon: "🏠", subcategories: ["Furniture", "Kitchen", "Bedding", "Decor"], children: [], productCount: 890, parentId: null },
  { id: "beauty", numericId: 0, name: "Beauty", icon: "💄", subcategories: ["Skincare", "Makeup", "Haircare", "Fragrance"], children: [], productCount: 650, parentId: null },
  { id: "sports", numericId: 0, name: "Sports", icon: "⚽", subcategories: ["Exercise", "Outdoor", "Team Sports", "Fitness"], children: [], productCount: 420, parentId: null },
  { id: "toys", numericId: 0, name: "Toys & Kids", icon: "🧸", subcategories: ["Action Figures", "Board Games", "Baby Toys", "Educational"], children: [], productCount: 380, parentId: null },
  { id: "grocery", numericId: 0, name: "Grocery", icon: "🛒", subcategories: ["Fresh Produce", "Snacks", "Beverages", "Dairy"], children: [], productCount: 560, parentId: null },
  { id: "automotive", numericId: 0, name: "Automotive", icon: "🚗", subcategories: ["Car Accessories", "Motorcycle", "Tools", "Care"], children: [], productCount: 210, parentId: null },
];

export const products: Product[] = [
  {
    id: "1",
    name: "Samsung Galaxy S25 Ultra",
    brand: "Samsung",
    category: "electronics",
    subcategory: "Mobiles & Tablets",
    price: 119999,
    originalPrice: 139999,
    rating: 4.8,
    reviews: 2341,
    image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&q=80",
    images: [
      "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80",
      "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=600&q=80",
      "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80",
    ],
    badge: "sale",
    inStock: true,
    description: "The Samsung Galaxy S25 Ultra is the ultimate premium smartphone with a built-in S Pen, powerful Snapdragon processor, and a stunning 6.8-inch Dynamic AMOLED display.",
    specs: {
      "Display": "6.8-inch Dynamic AMOLED 2X, 3088 × 1440",
      "Processor": "Snapdragon 8 Elite",
      "RAM": "12GB",
      "Storage": "256GB / 512GB / 1TB",
      "Camera": "200MP + 12MP + 50MP + 10MP",
      "Battery": "5000 mAh, 45W Fast Charging",
      "OS": "Android 15, One UI 7",
    },
    colors: ["#1a1a2e", "#e8e8e8", "#c9a96e"],
    storage: ["256GB", "512GB", "1TB"],
  },
  {
    id: "2",
    name: "Apple iPhone 16 Pro Max",
    brand: "Apple",
    category: "electronics",
    subcategory: "Mobiles & Tablets",
    price: 164999,
    originalPrice: 174999,
    rating: 4.9,
    reviews: 3120,
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&q=80"],
    badge: "new",
    inStock: true,
    description: "iPhone 16 Pro Max with A18 Pro chip, titanium design, and the most advanced camera system ever in an iPhone.",
    specs: {
      "Display": "6.9-inch Super Retina XDR ProMotion",
      "Processor": "A18 Pro chip",
      "RAM": "8GB",
      "Storage": "256GB / 512GB / 1TB",
      "Camera": "48MP Fusion + 12MP Ultra Wide + 5x Telephoto",
      "Battery": "4685 mAh, 30W MagSafe",
      "OS": "iOS 18",
    },
    colors: ["#b5b5b5", "#2c3e50", "#c8a96e", "#1a1a1a"],
    storage: ["256GB", "512GB", "1TB"],
  },
  {
    id: "3",
    name: "Sony WH-1000XM5",
    brand: "Sony",
    category: "electronics",
    subcategory: "TV & Audio",
    price: 34999,
    originalPrice: 44999,
    rating: 4.7,
    reviews: 1890,
    image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Industry-leading noise canceling with Auto NC Optimizer. Superior call quality with HD Voice and precise voice pickup.",
    specs: {
      "Driver": "30mm",
      "Frequency Response": "4Hz–40,000Hz",
      "Battery Life": "30 hours",
      "Noise Canceling": "Industry-leading ANC",
      "Connectivity": "Bluetooth 5.2, NFC",
      "Weight": "250g",
    },
    colors: ["#1a1a1a", "#e8e8e8"],
  },
  {
    id: "4",
    name: "Apple MacBook Air M3",
    brand: "Apple",
    category: "electronics",
    subcategory: "Laptops",
    price: 129999,
    originalPrice: 139999,
    rating: 4.8,
    reviews: 982,
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80"],
    badge: "new",
    inStock: true,
    description: "MacBook Air with M3 chip — incredibly thin, incredibly powerful.",
    specs: {
      "Chip": "Apple M3",
      "Display": "15.3-inch Liquid Retina",
      "RAM": "8GB / 16GB / 24GB",
      "Storage": "256GB / 512GB / 1TB / 2TB SSD",
      "Battery Life": "Up to 18 hours",
      "Weight": "1.51kg",
    },
    colors: ["#c2bbb0", "#1a1a2e", "#e8e8e8", "#f5a623"],
    storage: ["256GB", "512GB", "1TB"],
  },
  {
    id: "5",
    name: "OnePlus 13 5G",
    brand: "OnePlus",
    category: "electronics",
    subcategory: "Mobiles & Tablets",
    price: 79999,
    originalPrice: 89999,
    rating: 4.6,
    reviews: 756,
    image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "OnePlus 13 with Snapdragon 8 Elite and Hasselblad-tuned cameras.",
    specs: {
      "Display": "6.82-inch AMOLED, 120Hz",
      "Processor": "Snapdragon 8 Elite",
      "RAM": "12GB / 16GB",
      "Storage": "256GB / 512GB",
      "Camera": "50MP + 50MP + 50MP Hasselblad",
      "Battery": "6000 mAh, 100W SuperVOOC",
    },
    colors: ["#1a1a1a", "#2c5f2e", "#e8e8e8"],
    storage: ["256GB", "512GB"],
  },
  {
    id: "6",
    name: "Xiaomi Redmi Note 14 Pro",
    brand: "Xiaomi",
    category: "electronics",
    subcategory: "Mobiles & Tablets",
    price: 34999,
    originalPrice: 39999,
    rating: 4.4,
    reviews: 1234,
    image: "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=600&q=80"],
    badge: "hot",
    inStock: true,
    description: "Redmi Note 14 Pro with 200MP camera and 67W turbo charging.",
    specs: {
      "Display": "6.67-inch AMOLED, 120Hz",
      "Processor": "Helio G99-Ultra",
      "RAM": "8GB / 12GB",
      "Storage": "256GB",
      "Camera": "200MP + 8MP + 2MP",
      "Battery": "5020 mAh, 67W",
    },
    colors: ["#1a1a1a", "#9b59b6", "#3498db"],
    storage: ["256GB"],
  },
  {
    id: "7",
    name: "Samsung Galaxy Tab S10 Ultra",
    brand: "Samsung",
    category: "electronics",
    subcategory: "Mobiles & Tablets",
    price: 114999,
    originalPrice: 124999,
    rating: 4.7,
    reviews: 432,
    image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80"],
    badge: "new",
    inStock: true,
    description: "Galaxy Tab S10 Ultra with 14.6-inch Dynamic AMOLED 2X display.",
    specs: {
      "Display": "14.6-inch Dynamic AMOLED 2X",
      "Processor": "Snapdragon 8 Gen 3",
      "RAM": "12GB",
      "Storage": "256GB / 512GB",
      "Camera": "13MP + 8MP front",
      "Battery": "11200 mAh",
    },
  },
  {
    id: "8",
    name: "JBL Charge 5",
    brand: "JBL",
    category: "electronics",
    subcategory: "TV & Audio",
    price: 13999,
    originalPrice: 16999,
    rating: 4.5,
    reviews: 2103,
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Portable waterproof Bluetooth speaker with 20h of play time.",
    specs: {
      "Output Power": "40W",
      "Battery Life": "20 hours",
      "Waterproof": "IP67",
      "Bluetooth": "5.1",
      "Weight": "960g",
    },
    colors: ["#1a1a1a", "#e74c3c", "#3498db", "#27ae60"],
  },
  // ── Fashion ────────────────────────────────────────────────────────────────
  {
    id: "f1",
    name: "Premium Embroidered Saree",
    brand: "Aarong",
    category: "fashion",
    subcategory: "Women's Fashion",
    price: 4999,
    originalPrice: 6500,
    rating: 4.7,
    reviews: 892,
    image: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Beautifully embroidered saree with intricate floral patterns, perfect for special occasions.",
    specs: { "Fabric": "Silk blend", "Length": "6 yards", "Blouse": "Included", "Care": "Dry clean only" },
  },
  {
    id: "f2",
    name: "Men's Casual Panjabi",
    brand: "Yellow",
    category: "fashion",
    subcategory: "Men's Fashion",
    price: 1499,
    originalPrice: 1999,
    rating: 4.5,
    reviews: 1204,
    image: "https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Classic Bangladeshi panjabi made from premium cotton fabric, comfortable for daily wear.",
    specs: { "Fabric": "100% Cotton", "Fit": "Regular", "Sleeve": "Full", "Wash": "Machine washable" },
  },
  {
    id: "f3",
    name: "Women's Kurta Set",
    brand: "Desi Doll",
    category: "fashion",
    subcategory: "Women's Fashion",
    price: 2199,
    originalPrice: 2800,
    rating: 4.6,
    reviews: 743,
    image: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=600&q=80"],
    inStock: true,
    description: "Stylish 3-piece kurta set with printed dupatta, perfect for casual and festive occasions.",
    specs: { "Fabric": "Georgette", "Set": "3-piece", "Occasion": "Casual/Festive", "Wash": "Hand wash" },
  },
  {
    id: "f4",
    name: "Leather Oxford Shoes",
    brand: "Bata",
    category: "fashion",
    subcategory: "Footwear",
    price: 3499,
    originalPrice: 4200,
    rating: 4.4,
    reviews: 567,
    image: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Classic leather oxford shoes with durable sole, ideal for formal occasions.",
    specs: { "Material": "Genuine Leather", "Sole": "Rubber", "Closure": "Lace-up", "Occasion": "Formal" },
  },
  // ── Home & Living ──────────────────────────────────────────────────────────
  {
    id: "h1",
    name: "Ceramic Dinner Set (12 pieces)",
    brand: "Akij",
    category: "home-living",
    subcategory: "Kitchenware",
    price: 3299,
    originalPrice: 4500,
    rating: 4.6,
    reviews: 421,
    image: "https://images.unsplash.com/photo-1603199506016-b9a594b593c0?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1603199506016-b9a594b593c0?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Complete 12-piece ceramic dinner set with plates, bowls, and mugs in elegant white finish.",
    specs: { "Pieces": "12", "Material": "Ceramic", "Dishwasher Safe": "Yes", "Microwave Safe": "Yes" },
  },
  {
    id: "h2",
    name: "Wooden Bookshelf (5 Tier)",
    brand: "Hatil",
    category: "home-living",
    subcategory: "Furniture",
    price: 8999,
    originalPrice: 11000,
    rating: 4.5,
    reviews: 289,
    image: "https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Sturdy 5-tier wooden bookshelf with modern design, perfect for study rooms and living spaces.",
    specs: { "Material": "Solid Wood", "Tiers": "5", "Dimensions": "180 × 80 × 30 cm", "Load": "20kg per shelf" },
  },
  {
    id: "h3",
    name: "Non-Stick Cookware Set",
    brand: "Prestige",
    category: "home-living",
    subcategory: "Kitchenware",
    price: 4599,
    originalPrice: 5500,
    rating: 4.7,
    reviews: 1103,
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "5-piece non-stick cookware set with granite coating, suitable for all cooktops.",
    specs: { "Pieces": "5", "Coating": "Granite Non-Stick", "Oven Safe": "Up to 180°C", "Dishwasher": "Yes" },
  },
  {
    id: "h4",
    name: "LED Ceiling Light (24W)",
    brand: "Philips",
    category: "home-living",
    subcategory: "Lighting",
    price: 1299,
    originalPrice: 1700,
    rating: 4.4,
    reviews: 672,
    image: "https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Energy-efficient 24W LED ceiling light with warm white glow, suitable for bedrooms and halls.",
    specs: { "Wattage": "24W", "Lumens": "2400lm", "Color Temp": "3000K Warm White", "Lifespan": "25,000 hrs" },
  },
  // ── Beauty ─────────────────────────────────────────────────────────────────
  {
    id: "b1",
    name: "Vitamin C Face Serum",
    brand: "Garnier",
    category: "beauty",
    subcategory: "Skincare",
    price: 799,
    originalPrice: 999,
    rating: 4.6,
    reviews: 2341,
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Brightening Vitamin C serum that reduces dark spots and gives a radiant glow in 7 days.",
    specs: { "Volume": "30ml", "Skin Type": "All skin types", "Key Ingredient": "Vitamin C 30X", "SPF": "None" },
  },
  {
    id: "b2",
    name: "Matte Lipstick (Pack of 6)",
    brand: "Revlon",
    category: "beauty",
    subcategory: "Makeup",
    price: 1499,
    originalPrice: 1800,
    rating: 4.5,
    reviews: 876,
    image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Long-lasting matte lipstick set with 6 gorgeous shades, moisturizing formula.",
    specs: { "Pieces": "6 shades", "Finish": "Matte", "Duration": "8 hours", "Formula": "Moisturizing" },
  },
  {
    id: "b3",
    name: "Herbal Hair Growth Oil",
    brand: "Parachute",
    category: "beauty",
    subcategory: "Hair Care",
    price: 349,
    originalPrice: 450,
    rating: 4.7,
    reviews: 4521,
    image: "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Enriched with natural herbs and coconut oil to promote hair growth and reduce hair fall.",
    specs: { "Volume": "200ml", "Type": "Hair Oil", "Key Herbs": "Bhringraj, Amla", "Paraben Free": "Yes" },
  },
  {
    id: "b4",
    name: "Perfume – Rose Oud (EDP)",
    brand: "Rasasi",
    category: "beauty",
    subcategory: "Fragrance",
    price: 2499,
    originalPrice: 2999,
    rating: 4.8,
    reviews: 1134,
    image: "https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Luxurious rose and oud perfume with long-lasting woody floral fragrance.",
    specs: { "Volume": "100ml", "Type": "Eau de Parfum", "Longevity": "12+ hours", "Notes": "Rose, Oud, Musk" },
  },
  // ── Sports ─────────────────────────────────────────────────────────────────
  {
    id: "s1",
    name: "Cricket Bat – Full Size",
    brand: "Gray-Nicolls",
    category: "sports",
    subcategory: "Cricket",
    price: 3999,
    originalPrice: 5000,
    rating: 4.6,
    reviews: 512,
    image: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Professional-grade English willow cricket bat with premium grip and lightweight design.",
    specs: { "Wood": "English Willow", "Grade": "Grade 2", "Size": "Full (SH)", "Weight": "1.1–1.2 kg" },
  },
  {
    id: "s2",
    name: "Running Shoes – Air Cushion",
    brand: "Nike",
    category: "sports",
    subcategory: "Footwear",
    price: 7999,
    originalPrice: 9500,
    rating: 4.7,
    reviews: 1892,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "Lightweight running shoes with air cushion sole for maximum comfort during long runs.",
    specs: { "Upper": "Engineered Mesh", "Sole": "Air Cushion", "Drop": "10mm", "Weight": "280g" },
  },
  {
    id: "s3",
    name: "Yoga Mat – Premium Non-Slip",
    brand: "Lifelong",
    category: "sports",
    subcategory: "Fitness",
    price: 1299,
    originalPrice: 1799,
    rating: 4.5,
    reviews: 934,
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "6mm thick premium yoga mat with non-slip texture, includes carrying strap.",
    specs: { "Thickness": "6mm", "Material": "TPE", "Dimensions": "183 × 61 cm", "Weight": "900g" },
  },
  {
    id: "s4",
    name: "Football – Match Quality",
    brand: "Adidas",
    category: "sports",
    subcategory: "Football",
    price: 1999,
    originalPrice: 2500,
    rating: 4.8,
    reviews: 2103,
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&q=80"],
    badge: "sale",
    inStock: true,
    description: "FIFA-approved match quality football with thermally bonded panels and excellent air retention.",
    specs: { "Size": "5", "Material": "PU Leather", "Bladder": "Butyl", "FIFA Approved": "Yes" },
  },
];

export const orders = [
  {
    id: "#SHYC45447789",
    date: "21 May 2025",
    product: "Samsung Galaxy S25 Ultra",
    amount: 119999,
    status: "Delivered",
    image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=80&q=80",
  },
  {
    id: "#SHYC45447788",
    date: "18 May 2025",
    product: "Sony WH-1000XM5",
    amount: 34999,
    status: "Delivered",
    image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=80&q=80",
  },
  {
    id: "#SHYC45447787",
    date: "14 May 2025",
    product: "Apple iPhone 16 Pro Max",
    amount: 164999,
    status: "Processing",
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=80&q=80",
  },
];


export function formatPrice(price: number) {
  return `৳${price.toLocaleString("en-BD")}`;
}

export function formatDiscount(original: number, sale: number) {
  return Math.round(((original - sale) / original) * 100);
}

// ── API response types ─────────────────────────────────────────────────────────

interface ApiProduct {
  id: number;
  name: string;
  slug: string;
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  thumbnailUrl: string | null;
  imageUrls?: string[] | null;
  categoryId: number;
  categoryName: string;
  brandId: number | null;
  brandName: string | null;
  stock: number;
  isActive: boolean;
  avgRating: number | null;
  reviewCount?: number;
  description?: string | null;
}

interface ApiCategory {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  productCount: number;
  parentId: number | null;
}

// ── Mappers ────────────────────────────────────────────────────────────────────

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80";

export function mapApiProduct(p: ApiProduct): Product {
  const slug = (p.categoryName ?? "")
    .toLowerCase()
    .replace(/\s+&\s+/g, "-")
    .replace(/\s+/g, "-");
  const thumb = p.thumbnailUrl ?? PLACEHOLDER_IMAGE;
  const extraImages: string[] | null | undefined =
    p.imageUrls && p.imageUrls.length > 0
      ? p.imageUrls
      : (p as ApiProduct & { images?: string[] }).images?.length
        ? (p as ApiProduct & { images?: string[] }).images
        : null;
  const imgs: string[] = extraImages && extraImages.length > 0 ? extraImages : [thumb];
  return {
    id: p.id.toString(),
    name: p.name,
    brand: p.brandName ?? "",
    category: slug,
    subcategory: "",
    price: p.price,
    originalPrice: p.originalPrice ?? p.price,
    rating: p.avgRating ?? 0,
    reviews: p.reviewCount ?? 0,
    image: thumb,
    images: imgs,
    badge: p.discountPercent && p.discountPercent > 0 ? "sale" : undefined,
    inStock: (p.stock ?? 0) > 0,
    isFast: (p as ApiProduct & { isFast?: boolean }).isFast ?? false,
    description: p.description ?? "",
    specs: {},
  };
}

const CATEGORY_ICONS: Record<string, string> = {
  electronics: "💻",
  fashion: "👗",
  "home-living": "🏠",
  home: "🏠",
  beauty: "💄",
  sports: "⚽",
  toys: "🧸",
  grocery: "🛒",
  automotive: "🚗",
};

function mapApiCategory(c: ApiCategory): Category {
  return {
    id: c.slug,
    numericId: c.id,
    name: c.name,
    icon: CATEGORY_ICONS[c.slug] ?? "🛍️",
    subcategories: [],
    children: [],
    productCount: c.productCount ?? 0,
    parentId: c.parentId ?? null,
  };
}

// ── Async API fetch functions (used by server components) ──────────────────────

export async function fetchBanners(): Promise<Banner[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/banners`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = (Array.isArray(data) ? data : []) as Banner[];
    return list
      .filter(b => b.isActive)
      .sort((a, b) => a.position - b.position);
  } catch {
    return [];
  }
}

export async function searchProducts(params: {
  search?: string;
  categoryId?: number;
  sortBy?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  page?: number;
  limit?: number;
}): Promise<SearchResult> {
  try {
    const url = new URL(`${API_BASE_URL}/api/products`);
    if (params.search) url.searchParams.set("search", params.search);
    if (params.categoryId) url.searchParams.set("categoryId", String(params.categoryId));
    if (params.sortBy && params.sortBy !== "relevance") {
      const sortMap: Record<string, string> = { "price-asc": "price_asc", "price-desc": "price_desc" };
      url.searchParams.set("sortBy", sortMap[params.sortBy] ?? params.sortBy);
    }
    if (params.minPrice !== undefined) url.searchParams.set("minPrice", String(params.minPrice));
    if (params.maxPrice !== undefined) url.searchParams.set("maxPrice", String(params.maxPrice));
    if (params.inStock) url.searchParams.set("inStock", "true");
    url.searchParams.set("page", String(params.page ?? 1));
    url.searchParams.set("limit", String(params.limit ?? 20));

    const res = await fetch(url.toString());
    if (!res.ok) return { products: [], total: 0, totalPages: 0 };
    const data = await res.json();
    return {
      products: ((data.products ?? []) as ApiProduct[]).map(mapApiProduct),
      total: data.total ?? 0,
      totalPages: data.totalPages ?? 0,
    };
  } catch {
    return { products: [], total: 0, totalPages: 0 };
  }
}

export async function fetchProducts(params?: {
  search?: string;
  categoryId?: number;
  categoryIds?: number[];
  flashSale?: boolean;
  limit?: number;
}): Promise<Product[]> {
  try {
    const url = new URL(`${API_BASE_URL}/api/products`);
    if (params?.search) url.searchParams.set("search", params.search);
    if (params?.categoryIds && params.categoryIds.length > 0) {
      url.searchParams.set("categoryIds", params.categoryIds.join(","));
    } else if (params?.categoryId) {
      url.searchParams.set("categoryId", String(params.categoryId));
    }
    if (params?.flashSale) url.searchParams.set("flashSale", "true");
    if (params?.limit) url.searchParams.set("limit", String(params.limit));

    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.products ?? []) as ApiProduct[]).map(mapApiProduct);
  } catch {
    return [];
  }
}

export async function fetchProductById(id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p = (data.product ?? data) as ApiProduct;
    return mapApiProduct(p);
  } catch {
    return null;
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const flatList = (Array.isArray(data) ? data as ApiCategory[] : []);

    const mapped = flatList.map(mapApiCategory);
    const byId: Record<number, Category> = {};
    for (const cat of mapped) byId[cat.numericId] = cat;

    for (let i = 0; i < flatList.length; i++) {
      const raw = flatList[i];
      if (raw.parentId && byId[raw.parentId]) {
        byId[raw.parentId].children.push({
          id: raw.slug,
          numericId: raw.id,
          name: raw.name,
          productCount: raw.productCount ?? 0,
        });
      }
    }

    return mapped;
  } catch {
    return [];
  }
}
