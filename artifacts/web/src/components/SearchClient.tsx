"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { searchProducts } from "@/lib/data";
import type { Product } from "@/lib/data";

const PAGE_SIZE = 20;
const MAX_PRICE = 200000;

interface Props {
  query: string;
  categoryId?: number;
  initialResults: Product[];
  initialTotal: number;
}

export default function SearchClient({ query, categoryId, initialResults, initialTotal }: Props) {
  const [products, setProducts] = useState(initialResults);
  const [total, setTotal] = useState(initialTotal);
  const [sort, setSort] = useState("relevance");
  const [minRating, setMinRating] = useState(0);
  const [priceMax, setPriceMax] = useState(MAX_PRICE);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const isInitialRender = useRef(true);

  const doFetch = useCallback(async (
    currentSort: string,
    currentPage: number,
    currentPriceMax: number,
  ) => {
    setLoading(true);
    try {
      const result = await searchProducts({
        search: query,
        categoryId,
        sortBy: currentSort !== "relevance" ? currentSort : undefined,
        maxPrice: currentPriceMax < MAX_PRICE ? currentPriceMax : undefined,
        page: currentPage,
        limit: PAGE_SIZE,
      });
      setProducts(result.products);
      setTotal(result.total);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [query, categoryId]);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    doFetch(sort, page, priceMax);
  }, [sort, page, priceMax, doFetch]);

  const displayProducts = useMemo(() => {
    if (minRating === 0) return products;
    return products.filter(p => p.rating >= minRating);
  }, [products, minRating]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = minRating > 0 || priceMax < MAX_PRICE;
  const clearFilters = () => { setMinRating(0); setPriceMax(MAX_PRICE); setPage(1); };

  return (
    <div className="flex gap-6">
      <aside className="w-56 flex-shrink-0 hidden md:block">
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="w-full text-xs text-[#F0185A] border border-[#F0185A] rounded-lg py-1.5 hover:bg-pink-50 transition-colors"
            >
              Clear filters
            </button>
          )}

          <div>
            <h4 className="font-semibold text-gray-800 text-sm mb-3">Price Range</h4>
            <input
              type="range"
              min={0}
              max={MAX_PRICE}
              value={priceMax}
              onChange={e => { setPriceMax(Number(e.target.value)); setPage(1); }}
              className="w-full accent-[#F0185A]"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>৳0</span>
              <span className="font-medium text-[#F0185A]">
                {priceMax >= MAX_PRICE ? "Any" : `৳${priceMax.toLocaleString()}`}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="font-semibold text-gray-800 text-sm mb-3">Minimum Rating</h4>
            {[4, 3, 2].map(r => (
              <label key={r} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-2">
                <input
                  type="radio"
                  name="rating"
                  className="accent-[#F0185A]"
                  checked={minRating === r}
                  onChange={() => { setMinRating(r); setPage(1); }}
                />
                <span className="text-amber-400">{"★".repeat(r)}{"☆".repeat(5 - r)}</span> & up
              </label>
            ))}
            {minRating > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name="rating"
                  className="accent-[#F0185A]"
                  checked={minRating === 0}
                  onChange={() => { setMinRating(0); setPage(1); }}
                />
                <span>Any rating</span>
              </label>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {loading ? (
              <Loader2 className="w-4 h-4 text-[#F0185A] animate-spin flex-shrink-0" />
            ) : (
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <span className="text-sm text-gray-500 truncate">
              {total > 0
                ? <><strong className="text-gray-800">{total}</strong> results for <strong className="text-gray-800">&ldquo;{query}&rdquo;</strong></>
                : loading ? "Searching..." : <>No results for <strong className="text-gray-800">&ldquo;{query}&rdquo;</strong></>
              }
            </span>
          </div>
          {(initialResults.length > 0 || products.length > 0) && (
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none bg-white flex-shrink-0"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-8 h-8 text-[#F0185A] animate-spin" />
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {initialResults.length === 0 && total === 0 ? "No results found" : "No products match your filters"}
            </h2>
            <p className="text-gray-500 mb-6">
              {total === 0
                ? "Try different keywords or browse categories"
                : "Try adjusting your filters"}
            </p>
            {total === 0 ? (
              <Link href="/" className="bg-[#F0185A] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#c8124a] transition-colors">
                Browse All Products
              </Link>
            ) : (
              <button onClick={clearFilters} className="text-sm text-[#F0185A] underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayProducts.map(product => <ProductCard key={product.id} product={product} />)}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2 flex-wrap">
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${p === page ? "bg-[#F0185A] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#F0185A] hover:text-[#F0185A]"}`}
                  >
                    {p}
                  </button>
                ))}
                {totalPages > 10 && (
                  <span className="text-sm text-gray-400 self-center">…{totalPages} pages</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
