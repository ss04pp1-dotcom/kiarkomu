import React, { useRef, useState } from "react";
import { Image as ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api-url";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  onDominantColor?: (color: string) => void;
  className?: string;
  label?: string;
}

// 🎨 নতুন ফাংশন: ছবি থেকে কালার বের করার জন্য
const extractAverageColor = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // ── FIX 7: Defensive CORS/Canvas error handling ──
    // We resolve with a default color on any failure so uploads are never blocked.
    const DEFAULT_COLOR = "#FF385C";
    try {
      const img = new Image();
      // crossOrigin must be set BEFORE src to avoid CORS tainting the canvas
      img.crossOrigin = "anonymous";
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        try {
          URL.revokeObjectURL(objectUrl);
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
              if (!ctx) return resolve(DEFAULT_COLOR);

      // দ্রুত প্রসেস করার জন্য সাইজ ছোট করে নেওয়া হলো
      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);

      const imageData = ctx.getImageData(0, 0, 100, 100).data;
      let r = 0, g = 0, b = 0, count = 0;

      for (let i = 0; i < imageData.length; i += 4) {
        if (imageData[i + 3] >= 128) { // স্বচ্ছ (transparent) পিক্সেল বাদ দেওয়া
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }
      }

      if (count === 0) return resolve("#FF385C"); // ডিফল্ট কালার

      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);

          const toHex = (c: number) => c.toString(16).padStart(2, "0");
          resolve(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
        } catch {
          resolve(DEFAULT_COLOR);
        }
      };

      img.onerror = () => resolve(DEFAULT_COLOR);
      img.src = objectUrl;
    } catch {
      resolve(DEFAULT_COLOR);
    }
  });
};

export function ImageUpload({ value, onChange, onDominantColor, className, label }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    if (!file) return;
    setError("");
    setUploading(true);
    
    try {
      // ১. ফাইল থেকে ফ্রন্টএন্ডেই কালার বের করে ফেলা
      if (onDominantColor) {
        try {
          const color = await extractAverageColor(file);
          onDominantColor(color);
        } catch (err) {
          console.error("Color extraction failed", err);
        }
      }

      // ২. এবার ফাইলটি সার্ভারে আপলোড করা
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("shohure_admin_token");

      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onChange(data.url);
      
      // যদি ব্যাকএন্ড থেকে কালার আসে তবে সেটিই ব্যবহার করবে
      if (data.dominantColor && onDominantColor) {
        onDominantColor(data.dominantColor);
      }
      
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    if (onDominantColor) onDominantColor(""); // ছবি রিমুভ করলে কালারও রিসেট হবে
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("space-y-1", className)}>
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl cursor-pointer transition-colors group",
          value ? "border-blue-300 bg-blue-50/30" : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/20"
        )}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {value ? (
          <div className="relative">
            <img
              src={value}
              alt="Preview"
              className="w-full h-40 object-contain rounded-xl p-2"
              onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 shadow"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-gray-500 opacity-0 group-hover:opacity-100 bg-white/80 rounded py-1 transition-opacity">
              Click to change
            </div>
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center gap-2 text-gray-400">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            ) : (
              <>
                <div className="p-3 rounded-full bg-gray-100">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Click or drag to upload</p>
                  <p className="text-xs text-gray-400">PNG, JPG, WebP — max 5 MB</p>
                </div>
              </>
            )}
          </div>
        )}
        {uploading && value && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}