"use client";
import { usePublicConfig } from "@/lib/usePublicConfig";

export default function MarqueeTicker() {
  const { data: config } = usePublicConfig();
  const text = config?.webAnnouncementText;
  const active = config?.webAnnouncementActive !== false;

  if (!text || !active) return null;

  const segment = `${text}  •  `;
  const repeated = segment.repeat(8);

  return (
    <div className="w-full overflow-hidden bg-gradient-to-r from-[#F0185A] via-[#d41451] to-[#F0185A] rounded-xl py-2.5 my-4 select-none">
      <div className="flex items-center">
        <span className="flex-shrink-0 text-white text-xs font-bold px-3 border-r border-white/30 mr-3 tracking-wide uppercase whitespace-nowrap">
          📢 Notice
        </span>
        <div className="overflow-hidden flex-1">
          <span className="ticker-track text-white text-sm font-medium">
            {repeated}{repeated}
          </span>
        </div>
      </div>
    </div>
  );
}
