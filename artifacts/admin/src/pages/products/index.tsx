import React, { useState } from "react";
import { Link } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit, Image as ImageIcon, Package, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Products() {
  const [search, setSearch] = useState("");
  const { data: productsPage, isLoading } = useListProducts({ search: search || undefined });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Products</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search products..."
              className="pl-9 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-products"
            />
          </div>

          <Link href="/products/bulk">
            <a className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-blue-600 text-blue-600 hover:bg-blue-50 h-9 px-4 py-2">
              <Layers className="h-4 w-4 mr-2" />
              Bulk Add
            </a>
          </Link>
          <Link href="/products/new">
            <a className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-9 px-4 py-2" data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </a>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p>Loading products...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-600 font-medium border-b">
                <tr>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Stock</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productsPage?.products?.length ? (
                  productsPage.products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 border flex items-center justify-center overflow-hidden shrink-0">
                            {product.thumbnailUrl ? (
                              <img src={product.thumbnailUrl} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-xs text-gray-500 max-w-[200px] truncate">{product.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="bg-gray-50 font-normal">
                          {product.categoryName}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">৳ {product.price}</div>
                        {product.originalPrice && Number(product.originalPrice) > Number(product.price) && (
                          <div className="text-xs text-gray-400 line-through">৳ {product.originalPrice}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          product.stock > 10 ? "bg-green-50 text-green-700" :
                          product.stock > 0 ? "bg-yellow-50 text-yellow-700" :
                          "bg-red-50 text-red-700"
                        }`}>
                          {product.stock} in stock
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {product.isActive ? (
                          <span className="text-green-600 flex items-center gap-1.5 text-xs font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-600"></span> Active
                          </span>
                        ) : (
                          <span className="text-gray-500 flex items-center gap-1.5 text-xs font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span> Draft
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/products/${product.id}/edit`}>
                          <a className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50" data-testid={`edit-product-${product.id}`}>
                            <Edit className="h-4 w-4" />
                          </a>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Package className="h-8 w-8 text-gray-300" />
                        <p>No products found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
