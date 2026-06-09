"use client";
import Link from "next/link";
import { ChevronRight, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import type { Product as LocalProduct } from "@/lib/data";
import { useGetActiveFlashSale } from "@workspace/api-client-react";

function useCountdown(endsAt: string | undefined) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!endsAt) return;
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ hours: 0, minutes: 0, seconds: 0 }); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ hours: h, minutes: m, seconds: s });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return timeLeft;
}

function pad(n: number) { return n.toString().padStart(2, "0"); }

export default function FlashSalesPage() {
  const { data: flashSale } = useGetActiveFlashSale();
  const { hours, minutes, seconds } = useCountdown(flashSale?.endsAt);

  const saleProducts = (flashSale?.products ?? []) as unknown as LocalProduct[];

  const timerItems = [
    { val: pad(hours), label: "Hours" },
    { val: pad(minutes), label: "Minutes" },
    { val: pad(seconds), label: "Seconds" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800 font-medium">Flash Sales</span>
      </nav>

      <div className="bg-gradient-to-r from-[#F0185A] to-rose-500 rounded-2xl p-8 mb-8 text-white text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Zap className="w-8 h-8 fill-yellow-300 text-yellow-300" />
          <h1 className="text-3xl font-bold">{flashSale?.title ?? "Flash Sale"}</h1>
          <Zap className="w-8 h-8 fill-yellow-300 text-yellow-300" />
        </div>
        <p className="text-pink-100 mb-4">Massive discounts on top products. Limited time only!</p>
        <div className="flex justify-center gap-4">
          {timerItems.map(t => (
            <div key={t.label} className="bg-white/20 rounded-xl px-5 py-3">
              <p className="text-2xl font-bold">{t.val}</p>
              <p className="text-xs text-pink-100">{t.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {saleProducts.map(p => <ProductCard key={p.id} product={p} />)}
      </div>

      {saleProducts.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Zap className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No active flash sale right now.</p>
          <p className="text-sm mt-1">Check back soon for amazing deals!</p>
        </div>
      )}
    </div>
  );
}
