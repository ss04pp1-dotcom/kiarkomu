import React, { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { API_URL } from "@/lib/api-url";
import { useListCategories, useListBrands, useCreateProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Layers, CheckCircle2, AlertCircle, Loader2, Upload, ImageIcon } from "lucide-react";

const TOKEN_KEY = "shohure_admin_token";

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  price: string;
  originalPrice: string;
  stock: string;
  thumbnailUrl: string;
  thumbnailUploading: boolean;
  status: "idle" | "loading" | "success" | "error";
  errorMsg?: string;
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function makeRow(): ProductRow {
  return {
    id: Math.random().toString(36).slice(2),
    name: "", slug: "", price: "", originalPrice: "", stock: "0",
    thumbnailUrl: "", thumbnailUploading: false, status: "idle",
  };
}

function ThumbnailUpload({ row, onChange }: { row: ProductRow; onChange: (patch: Partial<ProductRow>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem(TOKEN_KEY) ?? "";

  const handleFile = async (file: File) => {
    onChange({ thumbnailUploading: true });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      onChange({ thumbnailUrl: url, thumbnailUploading: false });
    } catch {
      onChange({ thumbnailUploading: false });
    }
  };

  if (row.thumbnailUrl) {
    return (
      <div className="relative w-full h-9 group">
        <img src={row.thumbnailUrl} alt="thumbnail" className="h-9 w-full object-cover rounded border" />
        <button
          type="button"
          onClick={() => onChange({ thumbnailUrl: "" })}
          className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center rounded text-white text-xs"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      <button
        type="button"
        disabled={row.thumbnailUploading || row.status === "success"}
        onClick={() => inputRef.current?.click()}
        className="h-9 w-full border border-dashed border-gray-300 rounded flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-500 disabled:opacity-50 transition-colors"
      >
        {row.thumbnailUploading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Upload className="h-3 w-3" />
            <span>Upload</span>
          </>
        )}
      </button>
    </>
  );
}

export default function BulkAddProducts() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories } = useListCategories();
  const { data: brandsData } = useListBrands();
  const createProduct = useCreateProduct();

  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [rows, setRows] = useState<ProductRow[]>([makeRow(), makeRow()]);
  const [submitting, setSubmitting] = useState(false);

  const allCategories: any[] = (categories as any)?.categories ?? categories ?? [];
  const allBrands: any[] = (brandsData as any)?.brands ?? brandsData ?? [];

  const brandsForCategory = useMemo(() => {
    if (!categoryId) return allBrands;
    return allBrands.filter((b: any) => !b.categoryId || b.categoryId === parseInt(categoryId));
  }, [allBrands, categoryId]);

  const updateRow = (id: string, patch: Partial<ProductRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const handleNameChange = (id: string, name: string) => updateRow(id, { name, slug: toSlug(name) });
  const addRow = () => setRows(prev => [...prev, makeRow()]);
  const removeRow = (id: string) => { if (rows.length <= 1) return; setRows(prev => prev.filter(r => r.id !== id)); };

  const validRows = rows.filter(r => r.name.trim() && r.price.trim() && parseFloat(r.price) > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) { toast({ title: "Please select a category", variant: "destructive" }); return; }
    if (validRows.length === 0) { toast({ title: "Add at least one product with a name and price", variant: "destructive" }); return; }

    setSubmitting(true);
    let successCount = 0;

    for (const row of validRows) {
      updateRow(row.id, { status: "loading" });
      try {
        await createProduct.mutateAsync({
          data: {
            name: row.name.trim(),
            slug: row.slug || toSlug(row.name),
            price: parseFloat(row.price),
            originalPrice: row.originalPrice ? parseFloat(row.originalPrice) : undefined,
            stock: parseInt(row.stock) || 0,
            categoryId: parseInt(categoryId),
            brandId: brandId ? parseInt(brandId) : undefined,
            thumbnailUrl: row.thumbnailUrl || undefined,
            isActive: true,
          } as any,
        });
        updateRow(row.id, { status: "success" });
        successCount++;
      } catch (err: any) {
        updateRow(row.id, { status: "error", errorMsg: err?.message ?? "Failed" });
      }
    }

    setSubmitting(false);
    await queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });

    if (successCount > 0) toast({ title: `${successCount} product${successCount > 1 ? "s" : ""} added successfully` });
    if (successCount === validRows.length) setTimeout(() => setLocation("/products"), 1200);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/products")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-blue-600" /> Bulk Add Products
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Add multiple products at once under the same category and brand</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category & Brand */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold mb-4 text-gray-800">1. Select Category & Brand</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category <span className="text-red-500">*</span></label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={categoryId}
                onChange={e => { setCategoryId(e.target.value); setBrandId(""); }}
                required
              >
                <option value="">Select category…</option>
                {allCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Brand <span className="text-gray-400 font-normal text-xs">(Optional)</span>
              </label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                value={brandId}
                onChange={e => setBrandId(e.target.value)}
                disabled={!categoryId}
              >
                <option value="">No brand / Any</option>
                {brandsForCategory.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Product rows */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">2. Add Products</h3>
            <span className="text-xs text-gray-500">{validRows.length} of {rows.length} ready to save</span>
          </div>

          {/* Header */}
          <div className="hidden md:grid px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wide"
            style={{ gridTemplateColumns: "20px 1fr 0.7fr 0.7fr 0.7fr 0.5fr 0.7fr 28px" }}>
            <div></div>
            <div>Name *</div>
            <div>Slug</div>
            <div>Price (৳) *</div>
            <div>Orig. Price</div>
            <div>Stock</div>
            <div className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Thumb</div>
            <div></div>
          </div>

          <div className="divide-y divide-gray-50">
            {rows.map((row, idx) => (
              <div
                key={row.id}
                className={`px-4 py-3 transition-colors ${row.status === "success" ? "bg-green-50" : row.status === "error" ? "bg-red-50" : ""}`}
              >
                <div
                  className="grid gap-2 items-center"
                  style={{ gridTemplateColumns: "20px 1fr 0.7fr 0.7fr 0.7fr 0.5fr 0.7fr 28px" }}
                >
                  <span className="text-xs text-gray-400 text-center">{idx + 1}</span>

                  <Input
                    placeholder="Product name"
                    value={row.name}
                    onChange={e => handleNameChange(row.id, e.target.value)}
                    disabled={row.status === "success"}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="auto-slug"
                    value={row.slug}
                    onChange={e => updateRow(row.id, { slug: e.target.value })}
                    disabled={row.status === "success"}
                    className="h-9 text-sm text-gray-500"
                  />
                  <Input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={row.price}
                    onChange={e => updateRow(row.id, { price: e.target.value })}
                    disabled={row.status === "success"}
                    className="h-9 text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={row.originalPrice}
                    onChange={e => updateRow(row.id, { originalPrice: e.target.value })}
                    disabled={row.status === "success"}
                    className="h-9 text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    value={row.stock}
                    onChange={e => updateRow(row.id, { stock: e.target.value })}
                    disabled={row.status === "success"}
                    className="h-9 text-sm"
                  />

                  <ThumbnailUpload row={row} onChange={patch => updateRow(row.id, patch)} />

                  <div className="flex items-center justify-center">
                    {row.status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    {row.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {row.status === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                    {row.status === "idle" && (
                      <button type="button" onClick={() => removeRow(row.id)} disabled={rows.length <= 1} className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-30">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {row.status === "error" && row.errorMsg && (
                  <p className="text-xs text-red-500 mt-1 pl-6">{row.errorMsg}</p>
                )}
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t bg-gray-50">
            <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus className="h-4 w-4" /> Add another row
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={() => setLocation("/products")}>Cancel</Button>
          <Button type="submit" disabled={submitting || validRows.length === 0 || !categoryId} className="min-w-[160px]">
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" /> Save {validRows.length} Product{validRows.length !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
