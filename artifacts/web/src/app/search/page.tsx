export const runtime = "edge";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { searchProducts } from "@/lib/data";
import SearchClient from "@/components/SearchClient";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const query = q?.trim() ?? "";
  const categoryId = category ? parseInt(category, 10) : undefined;
  const validCategoryId = categoryId && !isNaN(categoryId) ? categoryId : undefined;

  if (!query) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/" className="hover:text-[#F0185A]">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-800">Search</span>
        </nav>
        <div className="text-center py-24">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">What are you looking for?</h2>
          <p className="text-gray-500">Enter a search term in the box above to find products.</p>
        </div>
      </div>
    );
  }

  const { products, total } = await searchProducts({
    search: query,
    categoryId: validCategoryId,
    limit: 20,
    page: 1,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800">Search results for &ldquo;{query}&rdquo;</span>
      </nav>

      <SearchClient
        query={query}
        categoryId={validCategoryId}
        initialResults={products}
        initialTotal={total}
      />
    </div>
  );
}
