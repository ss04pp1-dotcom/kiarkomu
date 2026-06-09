import { Suspense } from "react";
import { notFound } from "next/navigation";
import { fetchProductById, fetchProducts } from "@/lib/data";
import ProductDetailClient from "@/components/ProductDetailClient";
import { Loader2 } from "lucide-react";

export const runtime = "edge";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, allProducts] = await Promise.all([
    fetchProductById(id),
    fetchProducts({ limit: 20 }),
  ]);

  if (!product) return notFound();

  const related = allProducts
    .filter(p => p.id !== id && p.category === product.category)
    .slice(0, 4);
  const fallbackRelated = allProducts.filter(p => p.id !== id).slice(0, 4);

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#F0185A]" /></div>}>
      <ProductDetailClient
        product={product}
        related={related.length > 0 ? related : fallbackRelated}
      />
    </Suspense>
  );
}
