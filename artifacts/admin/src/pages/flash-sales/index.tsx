import React, { useState, useMemo } from "react";
import {
  useListFlashSales, useCreateFlashSale, useDeleteFlashSale, useUpdateFlashSale,
  useListProducts, getListFlashSalesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Zap, Search, CheckSquare, Square, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" });
}

function localNowPlus(days = 0) {
  const d = new Date(Date.now() + days * 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FlashSales() {
  const { data, isLoading } = useListFlashSales();
  const { data: productsPage } = useListProducts({ limit: 200 } as any);
  const createFlashSale = useCreateFlashSale();
  const deleteFlashSale = useDeleteFlashSale();
  const updateFlashSale = useUpdateFlashSale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({ title: "", startsAt: localNowPlus(0), endsAt: localNowPlus(1) });
  const [productSearch, setProductSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const allProducts: any[] = (productsPage as any)?.products ?? [];

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return q ? allProducts.filter((p) => p.name.toLowerCase().includes(q)) : allProducts;
  }, [allProducts, productSearch]);

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));

  const toggleProduct = (id: number) =>
    setSelectedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => { const s = new Set(prev); filteredProducts.forEach((p) => s.delete(p.id)); return s; });
    } else {
      setSelectedIds((prev) => { const s = new Set(prev); filteredProducts.forEach((p) => s.add(p.id)); return s; });
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(form.endsAt) <= new Date(form.startsAt)) {
      toast({ title: "End date must be after start date", variant: "destructive" });
      return;
    }
    createFlashSale.mutate(
      { data: { title: form.title, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), productIds: Array.from(selectedIds) } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFlashSalesQueryKey() });
          setForm({ title: "", startsAt: localNowPlus(0), endsAt: localNowPlus(1) });
          setSelectedIds(new Set());
          setProductSearch("");
          toast({ title: "Flash sale created" });
        },
        onError: () => toast({ title: "Failed to create flash sale", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteFlashSale.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFlashSalesQueryKey() }); toast({ title: "Flash sale deleted" }); },
      onError: () => toast({ title: "Failed to delete flash sale", variant: "destructive" }),
    });
  };

  const handleToggleActive = (sale: any) => {
    updateFlashSale.mutate({ id: sale.id, data: { isActive: !sale.isActive } as any }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFlashSalesQueryKey() }); toast({ title: sale.isActive ? "Deactivated" : "Activated" }); }
    });
  };

  const sales: any[] = (data as any)?.flashSales ?? data ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
        <Zap className="h-7 w-7 text-yellow-500" /> Flash Sales
      </h2>
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Create form */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold">Create Flash Sale</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="e.g. Summer Flash Sale" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Starts At</label>
                <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm(f => ({ ...f, startsAt: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ends At</label>
                <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm(f => ({ ...f, endsAt: e.target.value }))} required />
              </div>

              {/* Product picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    Select Products{" "}
                    {selectedIds.size > 0 && (
                      <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{selectedIds.size} selected</span>
                    )}
                  </label>
                  {selectedIds.size > 0 && (
                    <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => setSelectedIds(new Set())}>Clear all</button>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <Input placeholder="Search products…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
                <div className="border rounded-lg overflow-hidden">
                  {filteredProducts.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 select-none" onClick={toggleAll}>
                      {allFilteredSelected ? <CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" /> : <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                      <span className="text-xs font-medium text-gray-600">{allFilteredSelected ? "Deselect all" : "Select all"} ({filteredProducts.length})</span>
                    </div>
                  )}
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                    {filteredProducts.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-gray-400 flex flex-col items-center gap-1">
                        <Package className="h-5 w-5" />
                        <span>{allProducts.length === 0 ? "No products available" : "No match"}</span>
                      </div>
                    ) : filteredProducts.map((p: any) => (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors ${selectedIds.has(p.id) ? "bg-blue-50" : "hover:bg-gray-50"}`}
                        onClick={() => toggleProduct(p.id)}
                      >
                        {selectedIds.has(p.id) ? <CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" /> : <Square className="h-4 w-4 text-gray-300 flex-shrink-0" />}
                        {p.thumbnailUrl
                          ? <img src={p.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                          : <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0"><Package className="h-4 w-4 text-gray-400" /></div>}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                          <p className="text-xs text-gray-500">৳{p.price} · Stock: {p.stock}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={createFlashSale.isPending} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {createFlashSale.isPending ? "Creating…" : `Create${selectedIds.size > 0 ? ` (${selectedIds.size} products)` : ""}`}
              </Button>
            </form>
          </div>
        </div>

        {/* Flash sales list */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading…</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-4">Title</th>
                    <th className="px-4 py-4">Products</th>
                    <th className="px-4 py-4">Period</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((s) => {
                    const now = Date.now();
                    const timeStatus = now < new Date(s.startsAt).getTime() ? "upcoming" : now > new Date(s.endsAt).getTime() ? "ended" : "live";
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-medium">{s.title}</td>
                        <td className="px-4 py-4">
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{s.productIds?.length ?? 0} products</span>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-500">
                          <div>{fmtDate(s.startsAt)}</div>
                          <div>→ {fmtDate(s.endsAt)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <Badge variant={timeStatus === "live" ? "default" : "secondary"} className={timeStatus === "live" ? "bg-green-100 text-green-700 w-fit" : "w-fit"}>{timeStatus}</Badge>
                            <button onClick={() => handleToggleActive(s)} className={`text-xs px-2 py-0.5 rounded-full w-fit font-medium border transition-colors ${s.isActive ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}>
                              {s.isActive ? "Active" : "Inactive"}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {!sales.length && (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                      <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No flash sales yet. Create one to get started.</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
