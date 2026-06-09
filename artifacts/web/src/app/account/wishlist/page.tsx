"use client";
import Image from "next/image";
import Link from "next/link";
import { Trash2, ShoppingCart, Loader2 } from "lucide-react";
import { useGetWishlist, useRemoveFromWishlist } from "@workspace/api-client-react";
import type { WishlistItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCart } from "@/context/CartContext";

function formatPrice(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

function formatDiscount(original: number | null | undefined, current: number) {
  if (!original || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
}

export default function WishlistPage() {
  const queryClient = useQueryClient();
  const { addItem } = useCart();
  const { data: wishlist = [], isLoading } = useGetWishlist();
  const removeMutation = useRemoveFromWishlist();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["getWishlist"] });

  const handleRemove = async (productId: number) => {
    try { await removeMutation.mutateAsync({ productId }); invalidate(); } catch {}
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#F0185A] animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">My Wishlist ({wishlist.length} items)</h2>
      </div>

      {wishlist.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="text-5xl mb-4">💝</div>
          <p className="text-gray-500 font-medium mb-4">Your wishlist is empty</p>
          <Link href="/" className="bg-[#F0185A] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#c8124a] transition-colors">
            Explore Products
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(wishlist as WishlistItem[]).map(item => {
            const discount = formatDiscount(item.originalPrice, item.price);
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 items-center">
                <Link href={`/products/${item.productId}`} className="relative w-20 h-20 bg-gray-50 rounded-xl flex-shrink-0">
                  {item.thumbnailUrl ? (
                    <Image src={item.thumbnailUrl} alt={item.name} fill sizes="80px" className="object-contain p-2" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📦</div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">{item.categoryName ?? ""}</p>
                  <Link href={`/products/${item.productId}`}>
                    <h3 className="text-sm font-medium text-gray-800 hover:text-[#F0185A] line-clamp-2">{item.name}</h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-base font-bold text-gray-900">{formatPrice(item.price)}</span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <>
                        <span className="text-xs text-gray-400 line-through">{formatPrice(item.originalPrice)}</span>
                        <span className="text-xs text-[#F0185A] font-semibold bg-pink-50 px-1.5 py-0.5 rounded">-{discount}%</span>
                      </>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-block mt-1 ${item.stock > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                    {item.stock > 0 ? "In Stock" : "Out of Stock"}
                  </span>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => addItem({ id: item.productId, name: item.name, price: item.price, image: item.thumbnailUrl ?? "/placeholder.png", quantity: 1 })}
                    disabled={item.stock === 0}
                    className="flex items-center gap-1.5 bg-[#F0185A] hover:bg-[#c8124a] disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                  </button>
                  <button
                    onClick={() => handleRemove(item.productId)}
                    disabled={removeMutation.isPending}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:bg-red-50 border border-red-100 px-3 py-2 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
