import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { fetchCategories } from "@/lib/data";

export default async function CategoriesPage() {
  const allCategories = await fetchCategories();
  const rootCategories = allCategories.filter(c => c.parentId === null);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800 font-medium">All Categories</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">All Categories</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {rootCategories.map(cat => {
          const subcatNames = cat.children.length > 0
            ? cat.children.map(c => c.name)
            : cat.subcategories;
          return (
            <Link
              key={cat.id}
              href={`/categories/${cat.id}`}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:border-[#F0185A] transition-all group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center text-3xl group-hover:bg-pink-100 transition-colors">
                  {cat.icon}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{cat.name}</h2>
                  <p className="text-xs text-gray-400">{cat.productCount.toLocaleString()} products</p>
                </div>
              </div>
              {subcatNames.length > 0 && (
                <div className="space-y-1.5">
                  {subcatNames.slice(0, 3).map(sub => (
                    <div key={sub} className="flex items-center gap-2 text-sm text-gray-500 group-hover:text-gray-700">
                      <ChevronRight className="w-3 h-3 text-gray-300" />
                      {sub}
                    </div>
                  ))}
                  {subcatNames.length > 3 && (
                    <div className="text-xs text-gray-400 pl-5">+{subcatNames.length - 3} more</div>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
