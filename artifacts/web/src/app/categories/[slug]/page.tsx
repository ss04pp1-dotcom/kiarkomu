export const runtime = "edge";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProducts, fetchCategories } from "@/lib/data";
import CategoryClient from "@/components/CategoryClient";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const allCategories = await fetchCategories();
  const category = allCategories.find(c => c.id === slug);
  if (!category) return notFound();

  const parentCategory = category.parentId
    ? allCategories.find(c => c.numericId === category.parentId) ?? null
    : null;

  const effectiveParent = parentCategory ?? (category.children.length > 0 ? category : null);

  const categoryIds = category.children.length > 0
    ? [category.numericId, ...category.children.map(c => c.numericId)]
    : [category.numericId];

  const categoryProducts = await fetchProducts({
    categoryIds: categoryIds.length > 1 ? categoryIds : undefined,
    categoryId: categoryIds.length === 1 ? category.numericId : undefined,
  });

  const breadcrumbs = parentCategory
    ? [
        { label: "Home", href: "/" },
        { label: parentCategory.name, href: `/categories/${parentCategory.id}` },
        { label: category.name, href: null },
      ]
    : [
        { label: "Home", href: "/" },
        { label: category.name, href: null },
      ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="w-3 h-3" />}
            {crumb.href
              ? <Link href={crumb.href} className="hover:text-[#F0185A]">{crumb.label}</Link>
              : <span className="text-gray-800 font-medium">{crumb.label}</span>}
          </span>
        ))}
      </nav>

      <CategoryClient
        slug={slug}
        category={category}
        parentCategory={effectiveParent}
        allCategories={allCategories.filter(c => c.parentId === null)}
        initialProducts={categoryProducts}
      />
    </div>
  );
}
