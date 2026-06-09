import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, brandsTable, productsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { sql } from "drizzle-orm";

const router = Router();

const SAMPLE_CATEGORIES = [
  { name: "Electronics", nameBn: "ইলেকট্রনিক্স", slug: "electronics", imageUrl: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=200", position: 1 },
  { name: "Fashion", nameBn: "ফ্যাশন", slug: "fashion", imageUrl: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=200", position: 2 },
  { name: "Home & Living", nameBn: "হোম ও লিভিং", slug: "home-living", imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200", position: 3 },
  { name: "Beauty", nameBn: "বিউটি", slug: "beauty", imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200", position: 4 },
  { name: "Sports", nameBn: "স্পোর্টস", slug: "sports", imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200", position: 5 },
];

const SAMPLE_BRANDS = [
  { name: "Samsung", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Samsung_Logo.svg/200px-Samsung_Logo.svg.png" },
  { name: "Apple", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/200px-Apple_logo_black.svg.png" },
  { name: "Nike", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/200px-Logo_NIKE.svg.png" },
];

async function seedData() {
  const cats = await db.insert(categoriesTable)
    .values(SAMPLE_CATEGORIES)
    .onConflictDoNothing()
    .returning();

  const brands = await db.insert(brandsTable)
    .values(SAMPLE_BRANDS)
    .returning();

  const allCats = cats.length ? cats : await db.select().from(categoriesTable);
  const allBrands = brands.length ? brands : await db.select().from(brandsTable);

  if (!allCats.length) return 0;

  const getCatId = (name: string) => allCats.find(c => c.name === name)?.id ?? allCats[0].id;
  const getBrandId = (name: string) => allBrands.find(b => b.name === name)?.id ?? null;

  const SAMPLE_PRODUCTS = [
    { name: "Samsung Galaxy A54", nameBn: "স্যামসাং গ্যালাক্সি এ৫৪", slug: "samsung-galaxy-a54", price: "38999", originalPrice: "42999", categoryId: getCatId("Electronics"), brandId: getBrandId("Samsung"), stock: 50, thumbnailUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400", isFast: true },
    { name: "iPhone 15 Pro", nameBn: "আইফোন ১৫ প্রো", slug: "iphone-15-pro", price: "134999", originalPrice: "145000", categoryId: getCatId("Electronics"), brandId: getBrandId("Apple"), stock: 20, thumbnailUrl: "https://images.unsplash.com/photo-1697565026702-fa6d1c0d4f83?w=400", isFast: true },
    { name: "Samsung 43\" Smart TV", nameBn: "স্যামসাং ৪৩\" স্মার্ট টিভি", slug: "samsung-43-smart-tv", price: "28999", originalPrice: "35000", categoryId: getCatId("Electronics"), brandId: getBrandId("Samsung"), stock: 30, thumbnailUrl: "https://images.unsplash.com/photo-1461151304267-38535e780c79?w=400" },
    { name: "Wireless Earbuds Pro", nameBn: "ওয়্যারলেস ইয়ারবাড প্রো", slug: "wireless-earbuds-pro", price: "3499", originalPrice: "4999", categoryId: getCatId("Electronics"), brandId: null, stock: 200, thumbnailUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400" },
    { name: "Bluetooth Speaker Mini", nameBn: "ব্লুটুথ স্পিকার মিনি", slug: "bluetooth-speaker-mini", price: "2499", originalPrice: "3499", categoryId: getCatId("Electronics"), brandId: null, stock: 120, thumbnailUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400" },
    { name: "Men's Casual T-Shirt", nameBn: "পুরুষদের ক্যাজুয়াল টি-শার্ট", slug: "mens-casual-t-shirt", price: "599", originalPrice: "999", categoryId: getCatId("Fashion"), brandId: null, stock: 500, thumbnailUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400" },
    { name: "Women's Summer Dress", nameBn: "মহিলাদের গ্রীষ্মকালীন পোশাক", slug: "womens-summer-dress", price: "1299", originalPrice: "1799", categoryId: getCatId("Fashion"), brandId: null, stock: 300, thumbnailUrl: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400" },
    { name: "Nike Air Max 270", nameBn: "নাইকি এয়ার ম্যাক্স ২৭০", slug: "nike-air-max-270", price: "12999", originalPrice: "15999", categoryId: getCatId("Sports"), brandId: getBrandId("Nike"), stock: 100, thumbnailUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400" },
    { name: "Yoga Mat Premium", nameBn: "যোগ ম্যাট প্রিমিয়াম", slug: "yoga-mat-premium", price: "1899", originalPrice: "2499", categoryId: getCatId("Sports"), brandId: null, stock: 80, thumbnailUrl: "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=400" },
    { name: "Decorative Throw Pillow", nameBn: "ডেকোরেটিভ পিলো", slug: "decorative-throw-pillow", price: "799", originalPrice: "1199", categoryId: getCatId("Home & Living"), brandId: null, stock: 150, thumbnailUrl: "https://images.unsplash.com/photo-1592789705501-f9ae4278a9c9?w=400" },
    { name: "Ceramic Coffee Mug Set", nameBn: "সিরামিক কফি মগ সেট", slug: "ceramic-coffee-mug-set", price: "699", originalPrice: "999", categoryId: getCatId("Home & Living"), brandId: null, stock: 200, thumbnailUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400" },
    { name: "Face Moisturizer SPF30", nameBn: "ফেস ময়েশ্চারাইজার এসপিএফ৩০", slug: "face-moisturizer-spf30", price: "1199", originalPrice: "1499", categoryId: getCatId("Beauty"), brandId: null, stock: 250, thumbnailUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400" },
  ];

  const inserted = await db.insert(productsTable)
    .values(SAMPLE_PRODUCTS.map(p => ({
      ...p,
      isActive: true,
      isFast: p.isFast ?? false,
      images: [],
      specifications: {},
    })))
    .onConflictDoNothing()
    .returning();

  return inserted.length;
}

router.post("/admin/seed", requireAuth, requireRole("owner"), async (_req, res) => {
  try {
    const count = await seedData();
    res.json({ success: true, message: `Seeded ${count} products successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/seed/reset", requireAuth, requireRole("owner"), async (_req, res) => {
  // Block destructive reset in production unless explicitly overridden.
  // This prevents accidental data wipe on live databases.
  if (process.env["NODE_ENV"] === "production" && process.env["ALLOW_SEED_RESET"] !== "true") {
    res.status(403).json({
      error: "Seed reset is disabled in production. Set ALLOW_SEED_RESET=true to enable it explicitly.",
    });
    return;
  }
  try {
    await db.execute(sql`TRUNCATE products, brands, categories RESTART IDENTITY CASCADE`);
    const count = await seedData();
    res.json({ success: true, message: `Reset complete — ${count} products seeded` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
