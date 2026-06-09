"use client";
import Link from "next/link";
import Image from "next/image";
import { Heart, Star, ShoppingCart, Check, Zap } from "lucide-react";
import { type Product, formatPrice, formatDiscount } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useCart } from "@/context/CartContext";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export default function ProductCard({ product, className }: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(false);
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();
  const discount = formatDiscount(product.originalPrice, product.price);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product, 1);
    import("@/lib/tracking").then(({ trackAddToCart }) => {
      trackAddToCart({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        category: (product as any).category ?? null,
        quantity: 1,
      });
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className={cn("bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all group", className)}>
      <div className="relative">
        <Link href={`/products/${product.id}`}>
          <div className="relative w-full h-40 sm:h-48 bg-gray-50">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        </Link>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.badge && (
            <span className={cn(
              "text-white text-xs font-semibold px-2 py-0.5 rounded",
              product.badge === "new" && "bg-blue-500",
              product.badge === "sale" && "bg-[#F0185A]",
              product.badge === "hot" && "bg-orange-500",
            )}>
              {product.badge === "new" ? "NEW" : product.badge === "sale" ? `-${discount}%` : "HOT"}
            </span>
          )}
          {product.isFast && (
            <span className="flex items-center gap-0.5 bg-green-500 text-white text-xs font-semibold px-2 py-0.5 rounded">
              <Zap className="w-3 h-3" /> Fast
            </span>
          )}
        </div>

        {/* Wishlist — always visible on mobile, hover on desktop */}
        <button
          onClick={(e) => { e.preventDefault(); setWishlisted(!wishlisted); }}
          className={cn(
            "absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 bg-white rounded-full shadow-sm flex items-center justify-center transition-all hover:bg-pink-50",
            "opacity-100 md:opacity-0 md:group-hover:opacity-100",
            wishlisted && "md:opacity-100"
          )}
          aria-label="Wishlist"
        >
          <Heart className={cn("w-3.5 h-3.5", wishlisted ? "fill-[#F0185A] text-[#F0185A]" : "text-gray-400")} />
        </button>
      </div>

      <div className="p-2.5 sm:p-3">
        <p className="text-xs text-gray-400 mb-0.5 truncate">{product.brand}</p>
        <Link href={`/products/${product.id}`}>
          <h3 className="text-xs sm:text-sm font-medium text-gray-800 line-clamp-2 hover:text-[#F0185A] transition-colors leading-snug">
            {product.name}
          </h3>
        </Link>

        {product.rating > 0 && (
          <div className="flex items-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className={cn("w-2.5 h-2.5 sm:w-3 sm:h-3", i <= Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200")} />
            ))}
            <span className="text-xs text-gray-400 ml-0.5 hidden sm:inline">({product.reviews.toLocaleString()})</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-sm font-bold text-gray-900">{formatPrice(product.price)}</span>
          {product.originalPrice > product.price && (
            <span className="text-xs text-gray-400 line-through hidden sm:inline">{formatPrice(product.originalPrice)}</span>
          )}
        </div>

        {/* Add to Cart — always visible on mobile, hover-reveal on desktop */}
        <button
          onClick={handleAddToCart}
          disabled={!product.inStock}
          className={cn(
            "mt-2 w-full py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-all",
            added
              ? "bg-green-500 text-white"
              : product.inStock
              ? "bg-[#F0185A] hover:bg-[#c8124a] text-white md:opacity-0 md:group-hover:opacity-100"
              : "bg-gray-100 text-gray-400 cursor-not-allowed",
          )}
        >
          {added ? (
            <><Check className="w-3 h-3" /> Added!</>
          ) : product.inStock ? (
            <><ShoppingCart className="w-3 h-3" /> Add to Cart</>
          ) : (
            "Out of Stock"
          )}
        </button>
      </div>
    </div>
  );
}
