"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SlidersHorizontal, X, ChevronRight } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import type { Product, Category } from "@/lib/data";

const PAGE_SIZE = 12;

interface Props {
  slug: string;
  category: Category;
  parentCategory: Category | null;
  allCategories: Category[];
  initialProducts: Product[];
}

export default function CategoryClient({ slug, category, parentCategory, allCategories, initialProducts }: Props) {
  const brands = useMemo(() => [...new Set(initialProducts.map(p => p.brand).filter(Boolean))] as string[], [initialProducts]);
  const maxPrice = useMemo(() => Math.max(...initialProducts.map(p => p.price), 200000), [initialProducts]);

  const [sort, setSort] = useState("popularity");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [priceMax, setPriceMax] = useState(maxPrice);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const subcategoryList = parentCategory?.children ?? [];

  const filtered = useMemo(() => {
    let list = [...initialProducts];
    if (selectedBrands.length > 0) list = list.filter(p => selectedBrands.includes(p.brand));
    if (minRating > 0) list = list.filter(p => p.rating >= minRating);
    if (priceMax < maxPrice) list = list.filter(p => p.price <= priceMax);
    if (inStockOnly) list = list.filter(p => p.inStock);
    switch (sort) {
      case "price-asc": list.sort((a, b) => a.price - b.price); break;
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "rating": list.sort((a, b) => b.rating - a.rating); break;
      case "discount": list.sort((a, b) => (b.originalPrice - b.price) - (a.originalPrice - a.price)); break;
    }
    return list;
  }, [initialProducts, selectedBrands, minRating, priceMax, inStockOnly, sort, maxPrice]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleBrand = (brand: string) => {
    setPage(1);
    setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);
  };

  const hasActiveFilters = selectedBrands.length > 0 || minRating > 0 || priceMax < maxPrice || inStockOnly;

  const clearFilters = () => {
    setSelectedBrands([]);
    setMinRating(0);
    setPriceMax(maxPrice);
    setInStockOnly(false);
    setPage(1);
  };

  const FilterPanel = () => (
    <div className="space-y-4">
      {subcategoryList.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="bg-[#F0185A] px-4 py-3 text-white text-sm font-semibold">
            {parentCategory ? parentCategory.name : category.name}
          </div>
          <Link
            href={`/categories/${parentCategory ? parentCategory.id : category.id}`}
            className={`flex items-center justify-between px-4 py-2.5 text-sm border-b border-gray-50 hover:text-[#F0185A] hover:bg-pink-50 transition-colors ${!parentCategory || slug === parentCategory?.id ? "text-[#F0185A] bg-pink-50 font-medium" : "text-gray-700"}`}
          >
            <span>All {parentCategory ? parentCategory.name : category.name}</span>
            <span className="text-xs text-gray-400">{(parentCategory ?? category).productCount}</span>
          </Link>
          {subcategoryList.map(sub => (
            <Link
              key={sub.id}
              href={`/categories/${sub.id}`}
              className={`flex items-center justify-between px-4 py-2.5 text-sm border-b border-gray-50 hover:text-[#F0185A] hover:bg-pink-50 transition-colors ${sub.id === slug ? "text-[#F0185A] bg-pink-50 font-medium" : "text-gray-700"}`}
            >
              <span className="flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3 text-gray-300" />
                {sub.name}
              </span>
              <span className="text-xs text-gray-400">{sub.productCount}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="bg-gray-700 px-4 py-3 text-white text-sm font-semibold">All Categories</div>
        {allCategories.map(cat => (
          <Link
            key={cat.id}
            href={`/categories/${cat.id}`}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b border-gray-50 hover:text-[#F0185A] hover:bg-pink-50 transition-colors ${cat.id === slug || cat.numericId === category.parentId ? "text-[#F0185A] bg-pink-50 font-medium" : "text-gray-700"}`}
          >
            {cat.icon} {cat.name}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
        {hasActiveFilters && (
          <button onClick={clearFilters} className="w-full text-xs text-[#F0185A] border border-[#F0185A] rounded-lg py-1.5 hover:bg-pink-50 transition-colors">
            Clear all filters
          </button>
        )}

        {brands.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-800 text-sm mb-3">Brand</h4>
            <div className="space-y-2">
              {brands.map(brand => (
                <label key={brand} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-[#F0185A]">
                  <input
                    type="checkbox"
                    className="accent-[#F0185A]"
                    checked={selectedBrands.includes(brand)}
                    onChange={() => toggleBrand(brand)}
                  />
                  {brand}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          <h4 className="font-semibold text-gray-800 text-sm mb-3">Price Range</h4>
          <input
            type="range"
            min={0}
            max={maxPrice}
            value={priceMax}
            onChange={e => { setPriceMax(Number(e.target.value)); setPage(1); }}
            className="w-full accent-[#F0185A]"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>৳0</span>
            <span className="font-medium text-[#F0185A]">৳{priceMax.toLocaleString()}</span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h4 className="font-semibold text-gray-800 text-sm mb-3">Minimum Rating</h4>
          <div className="space-y-2">
            {[4, 3, 2].map(r => (
              <label key={r} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name="rating"
                  className="accent-[#F0185A]"
                  checked={minRating === r}
                  onChange={() => { setMinRating(r); setPage(1); }}
                />
                <span className="text-amber-400">{"★".repeat(r)}{"☆".repeat(5 - r)}</span>
                <span>& up</span>
              </label>
            ))}
            {minRating > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="radio" name="rating" className="accent-[#F0185A]" checked={minRating === 0} onChange={() => { setMinRating(0); setPage(1); }} />
                <span>Any rating</span>
              </label>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#F0185A]"
              checked={inStockOnly}
              onChange={e => { setInStockOnly(e.target.checked); setPage(1); }}
            />
            In Stock Only
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex gap-6">
      <aside className="w-56 flex-shrink-0 hidden md:block">
        <FilterPanel />
      </aside>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-gray-50 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Filters</h3>
              <button onClick={() => setMobileFiltersOpen(false)}>
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <FilterPanel />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{category.name}</h1>
            <p className="text-sm text-gray-500">{filtered.length} products found</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="md:hidden flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-white"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters {hasActiveFilters && <span className="bg-[#F0185A] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{selectedBrands.length + (minRating > 0 ? 1 : 0) + (inStockOnly ? 1 : 0)}</span>}
            </button>
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none bg-white"
            >
              <option value="popularity">Sort: Popularity</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="discount">Biggest Discount</option>
            </select>
          </div>
        </div>

        {subcategoryList.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-5">
            <Link
              href={`/categories/${parentCategory ? parentCategory.id : category.id}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${!parentCategory || slug === parentCategory?.id ? "bg-[#F0185A] text-white border-[#F0185A]" : "bg-white text-gray-600 border-gray-200 hover:border-[#F0185A] hover:text-[#F0185A]"}`}
            >
              All
            </Link>
            {subcategoryList.map(sub => (
              <Link
                key={sub.id}
                href={`/categories/${sub.id}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${sub.id === slug ? "bg-[#F0185A] text-white border-[#F0185A]" : "bg-white text-gray-600 border-gray-200 hover:border-[#F0185A] hover:text-[#F0185A]"}`}
              >
                {sub.name}
              </Link>
            ))}
          </div>
        )}

        {initialProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">No products yet</h2>
            <p className="text-sm text-gray-500">Add products to this category from the admin panel.</p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">😕</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">No products match your filters</h2>
            <button onClick={clearFilters} className="text-sm text-[#F0185A] underline">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginated.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2 flex-wrap">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${p === page ? "bg-[#F0185A] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#F0185A] hover:text-[#F0185A]"}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
