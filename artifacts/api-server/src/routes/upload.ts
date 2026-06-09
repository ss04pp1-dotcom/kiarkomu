import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { requireAuth } from "../middlewares/requireAuth.js";
import { adminAuth } from "../middlewares/adminAuth.js";
import { getStorageConfig } from "../lib/storage-config.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — sharp will compress output
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ok =
      allowed.test(path.extname(file.originalname).toLowerCase()) &&
      allowed.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ── Feature 1: Image Optimization Pipeline using sharp ──
interface OptimizedImages {
  thumbnail: Buffer; // 200px wide
  medium: Buffer;    // 600px wide
  original: Buffer;  // max 1200px wide
}

async function optimizeImages(buffer: Buffer): Promise<OptimizedImages> {
  // Sharp's type definition exports itself directly (no .default wrapper needed in these types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharp = (await import("sharp")) as any;
  const [thumbnail, medium, original] = await Promise.all([
    sharp(buffer)
      .resize(200, 200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
    sharp(buffer)
      .resize(600, 600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer(),
    sharp(buffer)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer(),
  ]);
  return { thumbnail, medium, original };
}

async function extractDominantColor(buffer: Buffer): Promise<string | null> {
  try {
    const Vibrant = ((await import("node-vibrant")) as any).default ?? (await import("node-vibrant"));
    const palette = await Vibrant.from(buffer).getPalette();
    return palette.Vibrant?.hex ?? palette.DarkVibrant?.hex ?? null;
  } catch {
    return null;
  }
}

async function saveLocalFile(buffer: Buffer, filename: string, req: any): Promise<string> {
  const uploadsDir = path.join(__dirname, "../public/uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? (req.headers.host as string) ?? "";
  return `${proto}://${host}/api/uploads/${filename}`;
}

async function uploadToStorage(
  buffer: Buffer,
  filename: string,
  req: any
): Promise<string> {
  const storage = await getStorageConfig();

  if (storage.provider === "supabase" && storage.supabaseUrl && storage.supabaseServiceKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(storage.supabaseUrl, storage.supabaseServiceKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: -1 } },
      global: { fetch: fetch.bind(globalThis) },
    });
    const bucket = storage.supabaseBucket ?? "images";
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, { contentType: "image/webp", upsert: false });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
    return data.publicUrl;
  }

  return saveLocalFile(buffer, filename, req);
}

async function processAndUpload(fileBuffer: Buffer, originalname: string, req: any) {
  const baseName = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let optimized: OptimizedImages;
  try {
    optimized = await optimizeImages(fileBuffer);
  } catch {
    // Fallback: if sharp fails (e.g. unsupported format), upload original as-is
    const ext = path.extname(originalname).toLowerCase() || ".jpg";
    const url = await uploadToStorage(fileBuffer, `${baseName}${ext}`, req);
    const dominantColor = await extractDominantColor(fileBuffer);
    return { url, thumbnailUrl: url, mediumUrl: url, dominantColor };
  }

  const [url, thumbnailUrl, mediumUrl, dominantColor] = await Promise.all([
    uploadToStorage(optimized.original, `${baseName}.webp`, req),
    uploadToStorage(optimized.thumbnail, `${baseName}_thumb.webp`, req),
    uploadToStorage(optimized.medium, `${baseName}_medium.webp`, req),
    extractDominantColor(optimized.original),
  ]);

  return { url, thumbnailUrl, mediumUrl, dominantColor };
}

router.post("/upload", requireAuth, uploadMiddleware.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  try {
    const result = await processAndUpload(req.file.buffer, req.file.originalname, req);
    res.json(result);
  } catch {
    res.status(500).json({ error: "File upload failed. Please try again." });
  }
});

router.post("/admin/upload", adminAuth, uploadMiddleware.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  try {
    const result = await processAndUpload(req.file.buffer, req.file.originalname, req);
    res.json(result);
  } catch {
    res.status(500).json({ error: "File upload failed. Please try again." });
  }
});

export default router;
