"use client";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Heart, ShoppingCart, User, Menu, X, ChevronDown, Bell,
} from "lucide-react";
import type { Category } from "@/lib/data";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { usePublicConfig } from "@/lib/usePublicConfig";
import { API_BASE_URL } from "@/lib/config";

interface Suggestion {
  id: number;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  categoryName: string | null;
}

interface HeaderProps {
  categories: Category[];
}

export default function Header({ categories }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { totalItems } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { data: appSettings } = usePublicConfig();
  const siteName = appSettings?.siteName || "Shohure";

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/products/suggestions?q=${encodeURIComponent(q.trim())}`
      );
      if (!res.ok) return;
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, fetchSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const params = new URLSearchParams({ q: searchQuery.trim() });
    if (selectedCategory) params.set("category", selectedCategory);
    router.push(`/search?${params.toString()}`);
    setShowSuggestions(false);
    setMobileMenuOpen(false);
  };

  const handleSuggestionClick = (s: Suggestion) => {
    setShowSuggestions(false);
    setSearchQuery(s.name);
    router.push(`/products/${s.id}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Main bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#F0185A] rounded-lg flex items-center justify-center overflow-hidden">
              <span className="text-white text-xs sm:text-sm font-bold leading-none">{siteName.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-gray-900">{siteName}</span>
          </Link>

          {/* Desktop search */}
          <div ref={searchContainerRef} className="flex-1 max-w-2xl hidden md:block relative">
            <form onSubmit={handleSearch} className="flex">
              <div className="flex w-full border border-gray-200 rounded-lg overflow-hidden">
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="px-3 text-sm bg-gray-50 border-r border-gray-200 text-gray-600 cursor-pointer outline-none"
                >
                  <option value="">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={String(c.numericId)}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Search products, brands and more..."
                  className="flex-1 px-4 py-2 text-sm outline-none"
                  autoComplete="off"
                />
                <button type="submit" className="px-4 bg-[#F0185A] hover:bg-[#c8124a] text-white flex items-center transition-colors">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Desktop autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 mt-1 overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={() => handleSuggestionClick(s)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-pink-50 transition-colors ${i > 0 ? "border-t border-gray-50" : ""}`}
                  >
                    {s.thumbnailUrl ? (
                      <img src={s.thumbnailUrl} alt={s.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Search className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate font-medium">{s.name}</p>
                      {s.categoryName && (
                        <p className="text-xs text-gray-400 truncate">{s.categoryName}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* Desktop-only icons */}
            <Link href="/account/wishlist" className="hidden md:flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#F0185A] transition-colors">
              <Heart className="w-5 h-5" />
              <span className="text-xs">Wishlist</span>
            </Link>
            <Link href="/account/notifications" className="hidden md:flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#F0185A] transition-colors">
              <Bell className="w-5 h-5" />
              <span className="text-xs">Alerts</span>
            </Link>

            {/* Cart — visible on all sizes */}
            <Link href="/cart" className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#F0185A] transition-colors relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-xs hidden md:block">Cart</span>
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F0185A] text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </Link>

            {/* Account — desktop */}
            <Link
              href={isAuthenticated ? "/account" : "/login"}
              className="hidden md:flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#F0185A] transition-colors"
            >
              {isAuthenticated && user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name ?? ""} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
              <span className="text-xs">{isAuthenticated ? (user?.name?.split(" ")[0] ?? "Account") : "Sign In"}</span>
            </Link>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1 text-gray-600"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search bar */}
        <div className="mt-2 flex md:hidden relative">
          <form onSubmit={handleSearch} className="flex w-full">
            <div className="flex w-full border border-gray-200 rounded-lg overflow-hidden">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Search products..."
                className="flex-1 px-3 py-2 text-sm outline-none bg-gray-50"
                autoComplete="off"
              />
              <button type="submit" className="px-3 bg-[#F0185A] text-white flex items-center">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Mobile autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 mt-1 overflow-hidden">
              {suggestions.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => handleSuggestionClick(s)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-pink-50 transition-colors ${i > 0 ? "border-t border-gray-50" : ""}`}
                >
                  {s.thumbnailUrl ? (
                    <img src={s.thumbnailUrl} alt={s.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Search className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate font-medium">{s.name}</p>
                    {s.categoryName && (
                      <p className="text-xs text-gray-400 truncate">{s.categoryName}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop category nav */}
      <nav className="bg-white border-t border-gray-100 hidden md:block">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            <div
              className="relative flex-shrink-0"
              onMouseEnter={() => setCategoryOpen(true)}
              onMouseLeave={() => setCategoryOpen(false)}
            >
              <button className="flex items-center gap-2 px-4 py-3 bg-[#F0185A] text-white text-sm font-medium whitespace-nowrap">
                <Menu className="w-4 h-4" />
                All Categories
                <ChevronDown className="w-3 h-3" />
              </button>
              {categoryOpen && (
                <div className="absolute top-full left-0 w-56 bg-white shadow-xl border border-gray-100 z-50 max-h-80 overflow-y-auto">
                  {categories.map(cat => (
                    <Link
                      key={cat.id}
                      href={`/categories/${cat.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-pink-50 hover:text-[#F0185A] text-sm text-gray-700 transition-colors"
                    >
                      <span>{cat.icon}</span>
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {categories.slice(0, 6).map(cat => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}`}
                className="px-3 py-3 text-sm text-gray-700 hover:text-[#F0185A] whitespace-nowrap transition-colors flex-shrink-0"
              >
                {cat.name}
              </Link>
            ))}

            <Link href="/flash-sales" className="px-3 py-3 text-sm font-semibold text-[#F0185A] whitespace-nowrap flex-shrink-0">
              🔥 Flash Sale
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          {/* Category list */}
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 px-4 pt-2">
            {categories.map(cat => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 py-2.5 text-sm text-gray-700 hover:text-[#F0185A]"
              >
                <span className="text-base">{cat.icon}</span>
                {cat.name}
              </Link>
            ))}
            <Link
              href="/flash-sales"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 py-2.5 text-sm font-semibold text-[#F0185A]"
            >
              🔥 Flash Sale
            </Link>
          </div>

          {/* Quick links */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex gap-4">
            <Link href="/account/wishlist" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#F0185A] py-1">
              <Heart className="w-4 h-4" /> Wishlist
            </Link>
            <Link
              href={isAuthenticated ? "/account" : "/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#F0185A] py-1"
            >
              <User className="w-4 h-4" />
              {isAuthenticated ? "My Account" : "Sign In"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
