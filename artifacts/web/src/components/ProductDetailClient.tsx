"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Heart, ShoppingCart, Zap, Truck, Shield, RotateCcw,
  Star, ChevronRight, Minus, Plus, Check, Loader2, MessageSquare,
} from "lucide-react";
import type { Product } from "@/lib/data";
import { formatPrice, formatDiscount } from "@/lib/data";
import { cn } from "@/lib/utils";
import { usePublicConfig } from "@/lib/usePublicConfig";
import ProductCard from "@/components/ProductCard";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import {
  useGetWishlist, useAddToWishlist, useRemoveFromWishlist,
  useTrackProductView, useListProductReviews, useCreateReview,
  useGetRecommendedProducts,
  getGetWishlistQueryKey, getListProductReviewsQueryKey,
} from "@workspace/api-client-react";
import type { Review } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  product: Product;
  related: Product[];
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="transition-transform hover:scale-110"
        >
          <Star className={cn("w-7 h-7", (hover || value) >= i ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200")} />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review, siteName }: { review: Review; siteName: string }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-9 h-9 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
          {review.userAvatar ? (
            <img src={review.userAvatar} alt={review.userName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-sm font-bold">{review.userName?.charAt(0).toUpperCase() ?? "U"}</span>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">{review.userName}</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={cn("w-3.5 h-3.5", i <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200")} />
              ))}
            </div>
            <span className="text-xs text-gray-400">
              {new Date(review.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>
      {review.comment && <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>}
      {review.images && review.images.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {review.images.map((img, i) => (
            <img key={i} src={img} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-100" />
          ))}
        </div>
      )}
      {review.adminReply && (
        <div className="mt-3 p-3 bg-pink-50 border border-pink-100 rounded-lg text-xs text-gray-700">
          <span className="font-semibold text-[#F0185A]">{siteName}: </span>{review.adminReply}
        </div>
      )}
    </div>
  );
}

export default function ProductDetailClient({ product, related }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToCart, addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: publicConfig } = usePublicConfig();

  const numericProductId = parseInt(product.id, 10);
  const prefilledOrderItemId = searchParams.get("orderItem");

  const { data: wishlist = [] } = useGetWishlist({
    query: { queryKey: getGetWishlistQueryKey(), enabled: isAuthenticated },
  });
  const isWishlisted = wishlist.some(item => item.productId === numericProductId);

  const addToWishlistMutation = useAddToWishlist();
  const removeFromWishlistMutation = useRemoveFromWishlist();
  const wishlistLoading = addToWishlistMutation.isPending || removeFromWishlistMutation.isPending;

  const trackMutation = useTrackProductView();
  const { data: reviews = [], isLoading: reviewsLoading, refetch: refetchReviews } = useListProductReviews(numericProductId, {
    query: { queryKey: getListProductReviewsQueryKey(numericProductId), enabled: !!numericProductId },
  });
  const { data: recommended = [] } = useGetRecommendedProducts();
  const createReviewMutation = useCreateReview();

  type Variant = { id: number; productId: number; type: string; label: string; value: string; priceModifier: number; stock: number };

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("description");
  const [addedToCart, setAddedToCart] = useState(false);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewOrderItemId, setReviewOrderItemId] = useState(prefilledOrderItemId ?? "");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    if (numericProductId && !isNaN(numericProductId)) {
      trackMutation.mutateAsync({ id: numericProductId }).catch(() => {});
    }
  }, [numericProductId]);

  // Bug fix #3: useRef guard prevents double-fire in React 18 StrictMode (effects
  // run twice on mount in dev) and on accidental re-mounts. Mirrors the same
  // purchaseFired pattern already used correctly in order-success/page.tsx.
  const viewFired = useRef(false);
  useEffect(() => {
    if (!product || viewFired.current) return;
    viewFired.current = true;
    import("@/lib/tracking").then(({ trackViewContent }) => {
      trackViewContent({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        category: product.category ?? null,
      });
    });
  }, [product?.id]);

  useEffect(() => {
    if (!numericProductId || isNaN(numericProductId)) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://shohure-api.onrender.com"}/api/products/${numericProductId}/variants`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setVariants(data); })
      .catch(() => {});
  }, [numericProductId]);

  const variantsByType = variants.reduce<Record<string, Variant[]>>((acc, v) => {
    (acc[v.type] = acc[v.type] || []).push(v);
    return acc;
  }, {});

  // Detect combined "Color+Size" or "color_size" variant types
  const combinedTypeKey = Object.keys(variantsByType).find(
    t => t.toLowerCase().replace(/\s/g, "").includes("+") || t.toLowerCase() === "color_size"
  );
  const combinedVariants = combinedTypeKey ? variantsByType[combinedTypeKey] : [];

  function splitLabel(label: string | null | undefined): [string, string] | null {
    if (!label) return null;
    for (const sep of ["+", " / ", " - ", "/", "-"]) {
      const idx = label.indexOf(sep);
      if (idx > 0 && idx < label.length - sep.length) {
        return [label.slice(0, idx).trim(), label.slice(idx + sep.length).trim()];
      }
    }
    return null;
  }

  const colorSizePairs = combinedVariants
    .map(v => ({ variant: v, parts: splitLabel(v.value || v.label) }))
    .filter((x): x is { variant: Variant; parts: [string, string] } => x.parts !== null);

  const uniqueColors = [...new Set(colorSizePairs.map(x => x.parts[0]))];
  const uniqueSizes = [...new Set(colorSizePairs.map(x => x.parts[1]))];

  const matchedCombinedVariant = selectedColor && selectedSize
    ? colorSizePairs.find(x => x.parts[0] === selectedColor && x.parts[1] === selectedSize)?.variant ?? null
    : null;

  // Color name → CSS hex for swatches
  const COLOR_SWATCHES: Record<string, string> = {
    red: '#EF4444', blue: '#3B82F6', green: '#22C55E', black: '#111827',
    white: '#F9FAFB', yellow: '#FBBF24', pink: '#EC4899', purple: '#A855F7',
    orange: '#F97316', gray: '#9CA3AF', grey: '#9CA3AF', brown: '#92400E',
    navy: '#1E3A8A', 'navy blue': '#1E3A8A', cyan: '#06B6D4', teal: '#14B8A6',
    beige: '#D4B483', cream: '#FEF3C7', maroon: '#9F1239', olive: '#84CC16',
    silver: '#CBD5E1', gold: '#F59E0B', violet: '#7C3AED',
  };
  const colorToHex = (n: string) => COLOR_SWATCHES[n.toLowerCase()] ?? '#9CA3AF';
  const isLightHex = (hex: string) => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return (r*299+g*587+b*114)/1000 > 140;
  };

  // hasCombined = combined type found AND values could be split into colour/size pairs
  const hasCombined = !!combinedTypeKey && colorSizePairs.length > 0;

  // Price range from all combined variants
  // Bug #4: priceModifier is ABSOLUTE price override (not additive delta) when > 0
  const allCombinedPrices = colorSizePairs.map(x =>
    Number(x.variant.priceModifier) > 0 ? Number(x.variant.priceModifier) : product.price
  );
  const minCombinedPrice = allCombinedPrices.length > 0 ? Math.min(...allCombinedPrices) : product.price;
  const maxCombinedPrice = allCombinedPrices.length > 0 ? Math.max(...allCombinedPrices) : product.price;
  const hasPriceRange = hasCombined && minCombinedPrice !== maxCombinedPrice;

  // Individual (non-combined) variant types
  const individualTypes = Object.entries(variantsByType).filter(
    ([type]) => type !== combinedTypeKey
  );
  // If combined type exists but can't be split, fall back to showing combined variants as-is
  const unsplittableCombined = !!combinedTypeKey && colorSizePairs.length === 0
    ? Object.entries(variantsByType).filter(([t]) => t === combinedTypeKey)
    : [];
  const hasVariants = variants.length > 0;

  const allVariantsSelected = !hasVariants || (
    hasCombined
      ? selectedColor !== null && selectedSize !== null
      : [...individualTypes, ...unsplittableCombined].every(([type]) => selectedVariants[type] !== undefined)
  );

  // Bug #4: priceModifier is ABSOLUTE price override (not additive delta) when > 0
  const displayPrice: number = (() => {
    if (hasCombined && matchedCombinedVariant) {
      const mod = Number(matchedCombinedVariant.priceModifier);
      return mod > 0 ? mod : product.price;
    }
    const mods = Object.keys(selectedVariants)
      .map(type => {
        const v = variants.find(v2 => v2.type === type && v2.id === selectedVariants[type]);
        return Number(v?.priceModifier ?? 0);
      })
      .filter(m => m > 0);
    return mods.length > 0 ? Math.max(...mods) : product.price;
  })();

  // Bug #5: Track ALL selected variant IDs, not just the first
  const selectedVariantIds: number[] = hasCombined
    ? (matchedCombinedVariant ? [matchedCombinedVariant.id] : [])
    : (Object.values(selectedVariants).filter((id): id is number => id !== undefined));
  const selectedVariantId = selectedVariantIds[0];

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      router.push(`/login?returnTo=/products/${product.id}`);
      return;
    }
    try {
      if (isWishlisted) {
        await removeFromWishlistMutation.mutateAsync({ productId: numericProductId });
      } else {
        await addToWishlistMutation.mutateAsync({ productId: numericProductId });
      }
      queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() });
    } catch {}
  };

  const handleAddToCart = () => {
    if (hasVariants && !allVariantsSelected) return;
    addItem({
      id: numericProductId,
      name: product.name,
      price: displayPrice,
      image: product.image,
      quantity,
      variantId: selectedVariantId,
      variantIds: selectedVariantIds.length > 0 ? selectedVariantIds : undefined,
    });
    import("@/lib/tracking").then(({ trackAddToCart }) => {
      trackAddToCart({
        id: product.id,
        name: product.name,
        price: displayPrice,
        category: product.category ?? null,
        quantity,
      });
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) {
      router.push(`/login?returnTo=/products/${product.id}`);
      return;
    }
    if (hasVariants && !allVariantsSelected) return;
    try {
      sessionStorage.setItem("shohure_buynow", JSON.stringify({
        productId: numericProductId,
        name: product.name,
        price: displayPrice,
        image: product.image,
        quantity,
        variantId: selectedVariantId,
        variantIds: selectedVariantIds.length > 0 ? selectedVariantIds : undefined,
      }));
    } catch {}
    router.push("/checkout?mode=buynow");
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) { router.push(`/login?returnTo=/products/${product.id}#reviews`); return; }
    if (reviewRating === 0) { setReviewError("Please select a rating."); return; }
    const itemId = parseInt(reviewOrderItemId, 10);
    if (isNaN(itemId) || itemId <= 0) { setReviewError("Please enter a valid Order Item ID from your order details."); return; }
    setReviewSubmitting(true);
    setReviewError("");
    try {
      await createReviewMutation.mutateAsync({ id: numericProductId, data: { orderItemId: itemId, rating: reviewRating, comment: reviewComment.trim() || undefined } });
      setReviewSuccess(true);
      setReviewRating(0);
      setReviewComment("");
      setReviewOrderItemId("");
      refetchReviews();
    } catch (err: unknown) {
      setReviewError((err as { data?: { error?: string } })?.data?.error ?? "Failed to submit review. Make sure you purchased this product.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const discount = product.originalPrice > product.price ? formatDiscount(product.originalPrice, product.price) : 0;
  const approvedReviews = (reviews as Review[]).filter(r => r.isApproved);
  const avgRating = approvedReviews.length > 0 ? approvedReviews.reduce((s, r) => s + r.rating, 0) / approvedReviews.length : 0;
  const recommendedMapped = (recommended as Array<{
    id: number; name: string; price: number; originalPrice?: number | null;
    discountPercent?: number | null; thumbnailUrl?: string | null; stock: number;
    brandName?: string | null; categoryName: string; avgRating?: number | null; reviewCount: number;
  }>).slice(0, 4).map(p => ({
    id: p.id.toString(), name: p.name, brand: p.brandName ?? "",
    category: p.categoryName?.toLowerCase().replace(/\s+/g, "-") ?? "",
    subcategory: "", price: p.price, originalPrice: p.originalPrice ?? p.price,
    rating: p.avgRating ?? 0, reviews: p.reviewCount ?? 0,
    image: p.thumbnailUrl ?? "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80",
    images: [p.thumbnailUrl ?? "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80"],
    badge: (p.discountPercent && p.discountPercent > 0 ? "sale" : undefined) as "sale" | undefined,
    inStock: (p.stock ?? 0) > 0, description: "", specs: {},
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3 flex-shrink-0" />
        <Link href={`/categories/${product.category}`} className="hover:text-[#F0185A] capitalize">
          {product.category}
        </Link>
        <ChevronRight className="w-3 h-3 flex-shrink-0" />
        <span className="text-gray-800 font-medium truncate max-w-xs">{product.name}</span>
      </nav>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
          <div className="p-6 border-b md:border-b-0 md:border-r border-gray-100">
            <div className="relative w-full h-72 bg-gray-50 rounded-xl overflow-hidden mb-3">
              <Image
                src={product.images[selectedImage] ?? product.image}
                alt={product.name}
                fill sizes="(max-width: 768px) 100vw, 33vw"
                className="object-contain p-4" priority
              />
              {discount > 0 && (
                <span className="absolute top-3 left-3 bg-[#F0185A] text-white text-xs font-semibold px-2 py-1 rounded">
                  -{discount}%
                </span>
              )}
              {product.isFast && (
                <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Fast
                </span>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)} className={cn("w-16 h-16 rounded-lg border-2 overflow-hidden bg-gray-50 flex-shrink-0 transition-all", selectedImage === i ? "border-[#F0185A]" : "border-gray-100 hover:border-gray-300")}>
                    <Image src={img} alt="" width={64} height={64} className="object-contain w-full h-full p-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 lg:col-span-2">
            {product.brand && <p className="text-sm text-[#F0185A] font-medium mb-1">{product.brand}</p>}
            <h1 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h1>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {(product.rating > 0 || approvedReviews.length > 0) && (
                <>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className={cn("w-4 h-4", i <= Math.floor(avgRating || product.rating) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200")} />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">
                    {(avgRating || product.rating).toFixed(1)} ({approvedReviews.length > 0 ? approvedReviews.length : product.reviews} reviews)
                  </span>
                </>
              )}
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", product.inStock ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                {product.inStock ? "✓ In Stock" : "Out of Stock"}
              </span>
              {product.isFast && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700">
                  <Zap className="w-3 h-3" /> Fast Delivery
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 flex-wrap">
              <span className="text-3xl font-bold text-gray-900">
                {hasPriceRange && !matchedCombinedVariant
                  ? `${formatPrice(minCombinedPrice)} – ${formatPrice(maxCombinedPrice)}`
                  : formatPrice(displayPrice)}
              </span>
              {product.originalPrice > product.price && (
                <div>
                  <span className="text-base text-gray-400 line-through block">{formatPrice(product.originalPrice)}</span>
                  <span className="text-sm font-semibold text-[#F0185A]">Save {discount}%</span>
                </div>
              )}
            </div>

            {/* Combined Color+Size variant — show as separate pickers */}
            {hasCombined && (
              <>
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Colour
                    {!selectedColor && <span className="ml-1 text-xs font-normal text-red-400">— please select</span>}
                  </p>
                  <div className="flex gap-3 flex-wrap items-end">
                    {uniqueColors.map(color => {
                      const hex = colorToHex(color);
                      const light = isLightHex(hex);
                      const isSelected = selectedColor === color;
                      return (
                        <button
                          key={color}
                          onClick={() => { setSelectedColor(color); setSelectedSize(null); }}
                          className="flex flex-col items-center gap-1 group"
                          title={color}
                        >
                          <span
                            className={cn(
                              "w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center",
                              isSelected ? "border-[#F0185A] scale-110 shadow-md" : "border-transparent hover:border-gray-300"
                            )}
                            style={{ backgroundColor: hex }}
                          >
                            {isSelected && <Check className={cn("w-4 h-4", light ? "text-gray-900" : "text-white")} />}
                          </span>
                          <span className={cn("text-[10px] font-medium leading-none", isSelected ? "text-[#F0185A]" : "text-gray-500")}>
                            {color}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Size
                    {selectedColor && !selectedSize && <span className="ml-1 text-xs font-normal text-red-400">— please select</span>}
                    {!selectedColor && <span className="ml-1 text-xs font-normal text-gray-400">— select colour first</span>}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {uniqueSizes.map(size => {
                      const available = selectedColor
                        ? colorSizePairs.some(x => x.parts[0] === selectedColor && x.parts[1] === size)
                        : true;
                      const inStock = selectedColor
                        ? colorSizePairs.some(x => x.parts[0] === selectedColor && x.parts[1] === size && (x.variant.stock ?? 0) > 0)
                        : colorSizePairs.some(x => x.parts[1] === size && (x.variant.stock ?? 0) > 0);
                      const isDisabled = !selectedColor || !available || !inStock;
                      return (
                        <button
                          key={size}
                          disabled={isDisabled}
                          onClick={() => setSelectedSize(size)}
                          className={cn(
                            "px-3 py-1.5 text-sm rounded-lg border-2 transition-all font-medium",
                            selectedSize === size
                              ? "border-[#F0185A] text-[#F0185A] bg-pink-50"
                              : isDisabled
                                ? "border-gray-100 text-gray-300 cursor-not-allowed line-through opacity-60"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                          )}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {matchedCombinedVariant && (
                  <p className="text-xs text-green-600 mb-3 font-medium">
                    ✓ {selectedColor} / {selectedSize}
                    {(matchedCombinedVariant.stock ?? 0) > 0 && (
                      <span className="ml-2 text-gray-400 font-normal">({matchedCombinedVariant.stock} left in stock)</span>
                    )}
                  </p>
                )}
              </>
            )}

            {/* Individual variant types (non-combined) + unsplittable combined fallback */}
            {[...individualTypes, ...unsplittableCombined].map(([type, typeVariants]) => (
              <div key={type} className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2 capitalize">
                  {type.replace(/_/g, " ")}
                  {!selectedVariants[type] && <span className="ml-1 text-xs font-normal text-red-400">— please select</span>}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {typeVariants.map(v => {
                    const isSelected = selectedVariants[type] === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariants(prev => ({ ...prev, [type]: v.id }))}
                        className={cn(
                          "px-3 py-1.5 text-sm rounded-lg border-2 transition-all font-medium",
                          isSelected
                            ? "border-[#F0185A] text-[#F0185A] bg-pink-50"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        {v.value || v.label}
                        {v.priceModifier !== 0 && (
                          <span className="ml-1 text-xs opacity-70">({v.priceModifier > 0 ? "+" : ""}{formatPrice(v.priceModifier)})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2">Quantity</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-gray-50 transition-colors"><Minus className="w-4 h-4 text-gray-600" /></button>
                  <span className="px-4 py-2 text-sm font-semibold min-w-[3rem] text-center">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="px-3 py-2 hover:bg-gray-50 transition-colors"><Plus className="w-4 h-4 text-gray-600" /></button>
                </div>
                <span className="text-xs text-gray-400">{product.inStock ? "Available" : "Currently unavailable"}</span>
              </div>
            </div>

            {hasVariants && !allVariantsSelected && (
              <p className="text-xs text-red-500 mb-3 font-medium">
                ⚠ Please select {hasCombined ? "a colour and size" : "all options"} before adding to cart.
              </p>
            )}

            <div className="flex gap-3 mb-6 flex-wrap sm:flex-nowrap">
              <button
                onClick={handleAddToCart}
                disabled={!product.inStock || !allVariantsSelected}
                className={cn("flex-1 py-3 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all min-w-0",
                  addedToCart ? "bg-green-500 text-white"
                  : product.inStock && allVariantsSelected ? "bg-[#F0185A] hover:bg-[#c8124a] text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                {addedToCart ? <><Check className="w-5 h-5" /> Added to Cart!</> : <><ShoppingCart className="w-5 h-5" /> Add to Cart</>}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={!product.inStock || !allVariantsSelected}
                className={cn("flex-1 py-3 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors min-w-0",
                  product.inStock && allVariantsSelected ? "bg-gray-900 hover:bg-gray-800 text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                <Zap className="w-5 h-5" /> Buy Now
              </button>
              <button onClick={handleWishlistToggle} disabled={wishlistLoading} className={cn("w-12 h-12 rounded-xl border-2 flex-shrink-0 flex items-center justify-center transition-all", isWishlisted ? "border-[#F0185A] bg-pink-50" : "border-gray-200 hover:border-[#F0185A]")} aria-label="Wishlist">
                {wishlistLoading ? <Loader2 className="w-4 h-4 animate-spin text-[#F0185A]" /> : <Heart className={cn("w-5 h-5", isWishlisted ? "fill-[#F0185A] text-[#F0185A]" : "text-gray-400")} />}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#F0185A] flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-700">Free Delivery</p>
                  <p className="text-xs text-gray-400">Orders over ৳{Math.round(publicConfig?.freeDeliveryThreshold ?? 2000).toLocaleString("en-BD")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#F0185A] flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-700">100% Authentic</p>
                  <p className="text-xs text-gray-400">Genuine product</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#F0185A] flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-700">Easy Returns</p>
                  <p className="text-xs text-gray-400">7 days policy</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {["description", "specifications", "reviews", "shipping"].map(tab => (
              <button key={tab} id={tab === "reviews" ? "reviews" : undefined} onClick={() => setActiveTab(tab)} className={cn("px-5 py-4 text-sm font-medium capitalize transition-colors whitespace-nowrap flex-shrink-0", activeTab === tab ? "text-[#F0185A] border-b-2 border-[#F0185A]" : "text-gray-500 hover:text-gray-800")}>
                {tab}{tab === "reviews" && approvedReviews.length > 0 ? ` (${approvedReviews.length})` : ""}
              </button>
            ))}
          </div>
          <div className="p-6">
            {activeTab === "description" && (
              <p className="text-sm text-gray-600 leading-relaxed">{product.description || "No description available."}</p>
            )}
            {activeTab === "specifications" && (
              Object.keys(product.specs).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div key={key} className="flex border-b border-gray-50 pb-2">
                      <span className="text-sm font-medium text-gray-500 w-36 flex-shrink-0">{key}</span>
                      <span className="text-sm text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400">No specifications available.</p>
            )}
            {activeTab === "reviews" && (
              <div className="space-y-6">
                {approvedReviews.length > 0 && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-gray-900">{avgRating.toFixed(1)}</p>
                      <div className="flex gap-0.5 justify-center mt-1">
                        {[1,2,3,4,5].map(i => <Star key={i} className={cn("w-3.5 h-3.5", i <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200")} />)}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{approvedReviews.length} reviews</p>
                    </div>
                    <div className="flex-1 space-y-1">
                      {[5,4,3,2,1].map(star => {
                        const count = approvedReviews.filter(r => r.rating === star).length;
                        const pct = approvedReviews.length > 0 ? (count / approvedReviews.length) * 100 : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500 w-4">{star}</span>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-gray-400 w-4">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {reviewsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#F0185A]" /></div>
                ) : approvedReviews.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No reviews yet. Be the first to review!</div>
                ) : (
                  <div className="space-y-3">
                    {approvedReviews.map(review => <ReviewCard key={review.id} review={review} siteName={publicConfig?.siteName ?? "Shohure"} />)}
                  </div>
                )}

                <div className="border-t border-gray-100 pt-6">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#F0185A]" /> Write a Review
                  </h4>
                  {!isAuthenticated ? (
                    <div className="text-center py-6 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-500 mb-3">Please sign in to write a review</p>
                      <Link href={`/login?returnTo=/products/${product.id}`} className="text-sm text-[#F0185A] font-medium hover:underline">Sign In</Link>
                    </div>
                  ) : reviewSuccess ? (
                    <div className="text-center py-6 bg-green-50 border border-green-100 rounded-xl">
                      <p className="text-green-700 font-semibold">✓ Review submitted! It will appear after moderation.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleReviewSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Your Rating *</label>
                        <StarPicker value={reviewRating} onChange={setReviewRating} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Review</label>
                        <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3} placeholder="Share your experience with this product..." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Order Item ID * <span className="text-gray-400 font-normal">— find it in <Link href="/account/orders" className="text-[#F0185A] hover:underline">My Orders</Link> → Order Detail</span>
                        </label>
                        <input type="number" value={reviewOrderItemId} onChange={e => setReviewOrderItemId(e.target.value)} placeholder="e.g. 42" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors" />
                      </div>
                      {reviewError && <p className="text-xs text-red-500">{reviewError}</p>}
                      <button type="submit" disabled={reviewSubmitting || reviewRating === 0} className="px-6 py-2.5 bg-[#F0185A] hover:bg-[#c8124a] disabled:bg-pink-300 text-white font-semibold rounded-xl text-sm transition-colors flex items-center gap-2">
                        {reviewSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Submit Review"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
            {activeTab === "shipping" && (
              <div className="space-y-3 text-sm text-gray-600">
                <p>✓ Free delivery on orders over ৳2,000</p>
                <p>✓ Standard delivery: 2-5 business days</p>
                <p>✓ Express delivery available in Dhaka</p>
                <p>✓ 7-day return policy for unopened items</p>
                {product.isFast && <p className="text-green-600 font-medium">⚡ This product is eligible for Fast Delivery!</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {recommendedMapped.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Frequently Bought Together</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {recommendedMapped.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Related Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
