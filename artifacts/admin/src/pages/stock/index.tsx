import React, { useState, useEffect } from "react";
import { useListProducts, useUpdateProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { API_URL } from "@/lib/api-url";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, Check, X, Search, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "shohure_admin_token";

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <Badge className="bg-red-100 text-red-700 border-0">Out of Stock</Badge>;
  if (stock <= 10) return <Badge className="bg-orange-100 text-orange-700 border-0">Low — {stock}</Badge>;
  if (stock <= 20) return <Badge className="bg-yellow-100 text-yellow-700 border-0">{stock} left</Badge>;
  return <Badge className="bg-green-100 text-green-700 border-0">{stock} in stock</Badge>;
}

function VariantStockRow({ variant, onSaved }: { variant: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(variant.stock));
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const stock = parseInt(val);
    if (isNaN(stock) || stock < 0) { toast({ title: "Invalid stock value", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY) ?? "";
      const res = await fetch(`${API_URL}/api/products/${variant.productId}/variants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variants: [{ id: variant.id, type: variant.type, value: variant.value, priceModifier: parseFloat(variant.priceModifier) || 0, stock }] }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: `${variant.type}: ${variant.value} stock updated to ${stock}` });
      setEditing(false);
      onSaved();
    } catch {
      toast({ title: "Failed to update variant stock", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50 border">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">{variant.type}:</span>
        <span className="text-xs font-semibold text-gray-700">{variant.value}</span>
        {variant.priceModifier !== 0 && (
          <span className="text-xs text-blue-600">{variant.priceModifier > 0 ? `+৳${variant.priceModifier}` : `-৳${Math.abs(variant.priceModifier)}`}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Input type="number" min="0" value={val} onChange={e => setVal(e.target.value)} className="w-20 h-6 text-xs text-right" autoFocus onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />
            <Button size="icon" className="h-6 w-6 bg-green-600 hover:bg-green-700" onClick={save} disabled={saving}><Check className="h-3 w-3" /></Button>
            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setEditing(false)}><X className="h-3 w-3" /></Button>
          </>
        ) : (
          <>
            <StockBadge stock={variant.stock} />
            <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => { setVal(String(variant.stock)); setEditing(true); }}>{variant.stock === 0 ? "Restock" : "Edit"}</Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Stock() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [variantMap, setVariantMap] = useState<Record<number, any[]>>({});
  const { data: page, isLoading, refetch } = useListProducts({ search: search || undefined, limit: 100 });
  const updateProduct = useUpdateProduct();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editId, setEditId] = useState<number | null>(null);
  const [editStock, setEditStock] = useState("");

  const allProducts = page?.products ?? [];
  const products = allProducts.filter(p => {
    if (filter === "out") return p.stock === 0;
    if (filter === "low") return p.stock > 0 && p.stock <= 10;
    return true;
  });

  const outCount = allProducts.filter(p => p.stock === 0).length;
  const lowCount = allProducts.filter(p => p.stock > 0 && p.stock <= 10).length;

  const toggleExpand = async (productId: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) { next.delete(productId); return next; }
      next.add(productId);
      return next;
    });
    if (!variantMap[productId]) {
      try {
        const token = localStorage.getItem(TOKEN_KEY) ?? "";
        const res = await fetch(`${API_URL}/api/products/${productId}/variants`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Failed to load variants");
        const variants = await res.json();
        setVariantMap(prev => ({ ...prev, [productId]: variants }));
      } catch {
        toast({ title: "Failed to load variants", variant: "destructive" });
      }
    }
  };

  const reloadVariants = async (productId: number) => {
    try {
      const token = localStorage.getItem(TOKEN_KEY) ?? "";
      const res = await fetch(`${API_URL}/api/products/${productId}/variants`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to reload variants");
      const variants = await res.json();
      setVariantMap(prev => ({ ...prev, [productId]: variants }));
    } catch {
      toast({ title: "Failed to reload variants", variant: "destructive" });
    }
  };

  const startEdit = (p: any) => { setEditId(p.id); setEditStock(String(p.stock)); };
  const cancelEdit = () => setEditId(null);

  const saveStock = (p: any) => {
    const stock = parseInt(editStock);
    if (isNaN(stock) || stock < 0) { toast({ title: "Invalid stock value", variant: "destructive" }); return; }
    updateProduct.mutate(
      { id: p.id, data: { stock } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setEditId(null);
          toast({ title: `Stock updated to ${stock}` });
        },
        onError: () => toast({ title: "Failed to update stock", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Package className="h-7 w-7" /> Stock Management
        </h2>
      </div>

      {(outCount > 0 || lowCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {outCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">{outCount} product{outCount > 1 ? "s" : ""} out of stock</span>
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-700">{lowCount} product{lowCount > 1 ? "s" : ""} running low (≤10)</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            className="pl-9 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-lg border bg-white overflow-hidden text-sm">
          {(["all", "low", "out"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 capitalize transition-colors",
                filter === f ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {f === "all" ? `All (${allProducts.length})` : f === "low" ? `Low Stock (${lowCount})` : `Out (${outCount})`}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Update Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <React.Fragment key={p.id}>
                  <tr className={cn("hover:bg-gray-50/50 transition-colors", p.stock === 0 && "bg-red-50/30")}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          onClick={() => toggleExpand(p.id)}
                          title="Show variants"
                        >
                          {expandedIds.has(p.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <div className="h-10 w-10 rounded-lg bg-gray-100 border flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-gray-400" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 leading-tight">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{p.categoryName}</td>
                    <td className="px-6 py-4 font-medium">৳{p.price}</td>
                    <td className="px-6 py-4">
                      <StockBadge stock={p.stock} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editId === p.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={editStock}
                            onChange={(e) => setEditStock(e.target.value)}
                            className="w-24 h-8 text-sm text-right"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") saveStock(p); if (e.key === "Escape") cancelEdit(); }}
                          />
                          <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={() => saveStock(p)} disabled={updateProduct.isPending}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(p)}
                          className={cn("text-sm", p.stock === 0 && "border-red-300 text-red-600 hover:bg-red-50")}
                        >
                          {p.stock === 0 ? "Restock" : "Edit Stock"}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {/* Variant stock rows */}
                  {expandedIds.has(p.id) && (
                    <tr className="bg-gray-50/60">
                      <td colSpan={5} className="px-10 pb-3 pt-1">
                        {!variantMap[p.id] ? (
                          <p className="text-xs text-gray-400 py-2">Loading variants…</p>
                        ) : variantMap[p.id].length === 0 ? (
                          <p className="text-xs text-gray-400 py-2">No variants — product uses total stock above.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                            {variantMap[p.id].map((v: any) => (
                              <VariantStockRow key={v.id} variant={{ ...v, productId: p.id }} onSaved={() => reloadVariants(p.id)} />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!products.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>{filter !== "all" ? "No products match this filter" : "No products found"}</p>
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
