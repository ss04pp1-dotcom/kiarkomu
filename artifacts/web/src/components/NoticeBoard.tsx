"use client";
import { useState } from "react";
import { X, Info } from "lucide-react";
import { usePublicConfig } from "@/lib/usePublicConfig";

export default function NoticeBoard() {
  const [dismissed, setDismissed] = useState(false);
  const { data: config } = usePublicConfig();
  const announcement = config?.announcementText;

  if (!announcement || dismissed) return null;

  return (
    <div className="bg-[#F0185A] text-white text-sm relative">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 justify-center">
          <Info className="w-4 h-4 flex-shrink-0" />
          <p className="text-center leading-tight">{announcement}</p>
        </div>
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 hover:opacity-70 transition-opacity" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
