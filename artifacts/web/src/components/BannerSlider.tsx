"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Banner } from "@/lib/data";

const FALLBACK: Banner[] = [
  {
    id: -1,
    title: "Extra 15% Pre-payment Savings",
    imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80",
    linkUrl: "/categories/electronics",
    position: 0,
    isActive: true,
  },
  {
    id: -2,
    title: "Big Sale on Fashion & Lifestyle",
    imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80",
    linkUrl: "/categories/fashion",
    position: 1,
    isActive: true,
  },
  {
    id: -3,
    title: "Flash Deals — Up to 40% Off",
    imageUrl: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=1200&q=80",
    linkUrl: "/flash-sales",
    position: 2,
    isActive: true,
  },
];

const LABELS = ["Limited Offer", "New Collection", "Flash Sale"];

interface Props {
  banners: Banner[];
}

export default function BannerSlider({ banners }: Props) {
  const slides = banners.length > 0 ? banners : FALLBACK;
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const next = useCallback(
    () => setCurrent(c => (c + 1) % slides.length),
    [slides.length],
  );
  const prev = useCallback(
    () => setCurrent(c => (c - 1 + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const t = setInterval(next, 4500);
    return () => clearInterval(t);
  }, [next, paused, slides.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-gray-200 select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ aspectRatio: "16/5" }}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div key={s.id} className="relative min-w-full h-full flex-shrink-0">
            <Link href={s.linkUrl ?? "/"} tabIndex={i === current ? 0 : -1} className="relative block w-full h-full">
              <Image
                src={s.imageUrl}
                alt={s.title}
                fill
                className="object-cover"
                priority={i === 0}
                sizes="(max-width: 768px) 100vw, 75vw"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex items-center px-6 sm:px-10 md:px-14">
                <div className="max-w-sm">
                  <span className="inline-block bg-[#F0185A] text-white text-xs font-semibold px-3 py-1 rounded-full mb-3 tracking-wide uppercase">
                    {LABELS[i % LABELS.length]}
                  </span>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-tight mb-4 drop-shadow">
                    {s.title}
                  </h2>
                  <span className="inline-block bg-white text-gray-900 hover:bg-gray-100 font-semibold px-5 py-2 rounded-full text-sm transition-colors shadow">
                    Shop Now →
                  </span>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous banner"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 z-10"
          >
            <ChevronLeft className="w-4 h-4 text-gray-800" />
          </button>
          <button
            onClick={next}
            aria-label="Next banner"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 z-10"
          >
            <ChevronRight className="w-4 h-4 text-gray-800" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Slide ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-6 h-2 bg-white"
                    : "w-2 h-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
