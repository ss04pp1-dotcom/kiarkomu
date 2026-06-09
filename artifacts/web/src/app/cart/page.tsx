"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Minus, ChevronRight, Tag, ArrowRight, ShoppingBag, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/data";
import { useCart } from "@/context/CartContext";
import { useValidateCoupon } from "@workspace/api-client-react";
import { usePublicConfig } from "@/lib/usePublicConfig";

export default function CartPage() {
  const router = useRouter();
  const { items, removeFromCart, updateQuantity, subtotal } = useCart();
  const [coupon, setCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState("");

  const validateCouponMutation = useValidateCoupon();
  const { data: appSettings } = usePublicConfig();

  const freeThreshold = appSettings?.freeDeliveryThreshold ?? 500;
  const enableFreeDelivery = appSettings?.enableFreeDelivery !== false;
  const isFreeShipping = enableFreeDelivery && subtotal >= freeThreshold;
  const total = subtotal - couponDiscount;
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setCouponError("");
    try {
      const res = await validateCouponMutation.mutateAsync({
        data: { code: coupon.trim().toUpperCase(), orderAmount: subtotal },
      });
      if (res.valid) {
        setCouponDiscount(res.discount ?? 0);
        setCouponApplied(true);
      } else {
        setCouponError(res.message ?? "Invalid coupon code.");
      }
    } catch {
      setCouponError("Invalid or expired coupon code.");
    }
  };

  const removeCoupon = () => {
    setCouponApplied(false);
    setCouponDiscount(0);
    setCoupon("");
    setCouponError("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800 font-medium">Your Cart</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Your Cart {items.length > 0 && <span className="text-gray-400 font-normal text-lg">({totalQty} items)</span>}
      </h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-12 h-12 text-[#F0185A]" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6">Add items to get started</p>
          <Link href="/" className="bg-[#F0185A] text-white px-8 py-3 rounded-full font-medium hover:bg-[#c8124a] transition-colors">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4">
                <Link href={`/products/${item.id}`} className="relative w-24 h-24 bg-gray-50 rounded-lg flex-shrink-0 overflow-hidden">
                  <Image src={item.image} alt={item.name} fill sizes="96px" className="object-contain p-2" />
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">{item.brand}</p>
                  <Link href={`/products/${item.id}`}>
                    <h3 className="text-sm font-medium text-gray-800 hover:text-[#F0185A] transition-colors line-clamp-2">{item.name}</h3>
                  </Link>
                  <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => item.quantity > 1 ? updateQuantity(item.id, item.quantity - 1) : removeFromCart(item.id)}
                        className="px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
                        aria-label="Decrease"
                      >
                        <Minus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <span className="px-3 py-1.5 text-sm font-medium min-w-[2rem] text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
                        aria-label="Increase"
                      >
                        <Plus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                    </div>
                    <p className="font-bold text-gray-900 text-sm">{formatPrice(item.price * item.quantity)}</p>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#F0185A]" /> Apply Coupon
              </h3>
              {couponApplied ? (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  ✓ Coupon &ldquo;{coupon}&rdquo; applied — {formatPrice(couponDiscount)} off!
                  <button onClick={removeCoupon} className="text-xs text-gray-400 hover:text-red-500 ml-auto">Remove</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={coupon}
                      onChange={e => { setCoupon(e.target.value); setCouponError(""); }}
                      onKeyDown={e => e.key === "Enter" && applyCoupon()}
                      placeholder="Enter coupon code"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F0185A]"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={validateCouponMutation.isPending}
                      className="px-4 py-2 bg-[#F0185A] text-white text-sm font-medium rounded-lg hover:bg-[#c8124a] transition-colors disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {validateCouponMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Apply
                    </button>
                  </div>
                  {couponError && <p className="text-xs text-red-500">{couponError}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5 sticky top-24">
              <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({totalQty} items)</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className={isFreeShipping ? "text-green-600 font-medium" : "text-gray-400 text-xs italic"}>
                    {isFreeShipping ? "FREE" : "Calculated at checkout"}
                  </span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Coupon Discount</span>
                    <span>-{formatPrice(couponDiscount)}</span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-gray-900 text-base">
                  <span>{couponDiscount > 0 ? "Total (excl. shipping)" : "Subtotal"}</span>
                  <span>{formatPrice(total)}</span>
                </div>
                {!isFreeShipping && (
                  <p className="text-xs text-gray-400 text-right">+ shipping calculated at checkout</p>
                )}
              </div>
              <button
                onClick={() => {
                  const url = couponApplied && couponDiscount > 0 && coupon.trim()
                    ? `/checkout?coupon=${encodeURIComponent(coupon.trim().toUpperCase())}&couponDiscount=${couponDiscount}`
                    : "/checkout";
                  router.push(url);
                }}
                className="mt-5 w-full py-3 bg-[#F0185A] hover:bg-[#c8124a] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                Continue to Checkout
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                href="/"
                className="mt-3 w-full py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl flex items-center justify-center hover:border-[#F0185A] hover:text-[#F0185A] transition-colors"
              >
                Continue Shopping
              </Link>
            </div>

            {enableFreeDelivery && subtotal < freeThreshold && (
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-sm text-blue-700">
                🚚 Add {formatPrice(freeThreshold - subtotal)} more for <strong>free shipping</strong>!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
