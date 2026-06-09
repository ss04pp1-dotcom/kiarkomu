import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import BannerSlider from "@/components/BannerSlider";
import TrustBadges from "@/components/TrustBadges";
import MarqueeTicker from "@/components/MarqueeTicker";
import { fetchProducts, fetchCategories, fetchBanners } from "@/lib/data";

export default async function HomePage() {
  const [allProducts, allCategories, banners] = await Promise.all([
    fetchProducts({ limit: 100 }),
    fetchCategories(),
    fetchBanners(),
  ]);

  const featured = allProducts.slice(0, 8);
  const newArrivals = allProducts.filter(p => p.badge === "new");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 pt-4">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="hidden lg:block bg-white rounded-xl border border-gray-100 overflow-hidden self-start sticky top-20">
            <div className="bg-[#F0185A] px-4 py-3 text-white font-semibold text-sm flex items-center gap-2">
              <span>☰</span> All Categories
            </div>
            <div className="py-1">
              {allCategories.map(cat => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-pink-50 hover:text-[#F0185A] transition-colors border-b border-gray-50"
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="flex-1">{cat.name}</span>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <BannerSlider banners={banners} />
          </div>
        </div>

        <TrustBadges />

        <MarqueeTicker />

        <div className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Shop by Category</h2>
            <Link href="/categories" className="text-sm text-[#F0185A] font-medium hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2 sm:gap-3">
            {allCategories.map(cat => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}`}
                className="bg-white rounded-xl p-3 flex flex-col items-center gap-2 hover:shadow-md hover:border-[#F0185A] border border-gray-100 transition-all group"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-50 rounded-xl flex items-center justify-center text-xl sm:text-2xl group-hover:bg-pink-100 transition-colors">
                  {cat.icon}
                </div>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight line-clamp-2">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <h2 className="text-xl font-bold text-gray-900">Today&apos;s Best Deals</h2>
            </div>
            <Link href="/flash-sales" className="text-sm text-[#F0185A] font-medium hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl p-6 text-white flex items-center justify-between overflow-hidden">
            <div>
              <p className="text-blue-100 text-sm mb-1">Exclusive Offer</p>
              <h3 className="text-2xl font-bold mb-2">Big Savings on<br />Smartphones</h3>
              <Link
                href="/categories/electronics"
                className="bg-white text-blue-600 font-semibold px-5 py-2 rounded-full text-sm hover:shadow inline-block"
              >
                Shop Now
              </Link>
            </div>
            <div className="relative w-28 h-28 flex-shrink-0">
              <Image
                src="https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=200&q=80"
                alt="Phones"
                fill
                sizes="112px"
                className="object-contain"
              />
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-400 to-orange-400 rounded-2xl p-6 text-white flex flex-col justify-between">
            <div>
              <p className="text-amber-100 text-sm mb-1">Flash Deal</p>
              <h3 className="text-xl font-bold mb-1">Accessories<br />Up to 40% off</h3>
            </div>
            <Link
              href="/flash-sales"
              className="bg-white text-orange-500 font-semibold px-5 py-2 rounded-full text-sm hover:shadow inline-block self-start mt-3"
            >
              Grab Now
            </Link>
          </div>
        </div>

        {newArrivals.length > 0 && (
          <div className="mt-8 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">New Arrivals</h2>
              <Link
                href="/categories/electronics"
                className="text-sm text-[#F0185A] font-medium hover:underline flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {newArrivals.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
