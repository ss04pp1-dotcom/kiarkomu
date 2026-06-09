"use client";
import { Truck, Shield, Star, Zap } from "lucide-react";
import { usePublicConfig } from "@/lib/usePublicConfig";

export default function TrustBadges() {
  const { data: config } = usePublicConfig();
  const threshold = config?.freeDeliveryThreshold
    ? Math.round(config.freeDeliveryThreshold).toLocaleString("en-BD")
    : "2000";

  const features = [
    { icon: <Truck className="w-5 h-5 text-[#F0185A]" />, title: "Free Delivery", subtitle: `Orders over ৳${threshold}` },
    { icon: <Shield className="w-5 h-5 text-[#F0185A]" />, title: "100% Authentic", subtitle: "Genuine products" },
    { icon: <Star className="w-5 h-5 text-[#F0185A]" />, title: "Easy Returns", subtitle: "7 days return policy" },
    { icon: <Zap className="w-5 h-5 text-[#F0185A]" />, title: "Best Price", subtitle: "Price match guarantee" },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
      {features.map((f, i) => (
        <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-3 border border-gray-100">
          <div className="w-9 h-9 bg-pink-50 rounded-lg flex items-center justify-center flex-shrink-0">
            {f.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{f.title}</p>
            <p className="text-xs text-gray-400">{f.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
