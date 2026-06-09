import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { API_URL } from "@/lib/api-url";

const TOKEN_KEY = "shohure_admin_token";
import {
  useCreateProduct, useGetProduct, useUpdateProduct,
  useListCategories, useListBrands, useListProducts,
  getListProductsQueryKey, getGetProductQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/image-upload";
import { ArrowLeft, Plus, X, Tag, Zap } from "lucide-react";

interface ProductFormProps {
  productId?: number;
}

const VARIANT_PRESETS: Record<string, string[]> = {
  "Size": ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "38", "39", "40", "41", "42", "43", "44"],
  "Color": ["Red", "Blue", "Green", "Black", "White", "Yellow", "Pink", "Purple", "Orange", "Gray", "Brown"],
  "Storage": ["64GB", "128GB", "256GB", "512GB", "1TB"],
  "RAM": ["4GB", "6GB", "8GB", "12GB", "16GB"],
};

function cartesianProduct(selections: Record<string, string[]>): Record<string, string>[] {
  const entries = Object.entries(selections).filter(([, vals]) => vals.length > 0);
  if (!entries.length) return [];
  return entries.reduce<Record<string, string>[]>((combos, [type, values]) => {
    if (!combos.length) return values.map(v => ({ [type]: v }));
    return combos.flatMap(combo => values.map(v => ({ ...combo, [type]: v })));
  }, []);
}

function comboKey(data: Record<string, string>): string {
  return Object.keys(data).sort().map(k => `${k}:${data[k]!}`).join("|");
}

function comboTypeStr(data: Record<string, string>): string {
  return Object.keys(data).sort().join("+");
}

function comboValueStr(data: Record<string, string>): string {
  return Object.keys(data).sort().map(k => data[k]!).join("+");
}

type SubProdItem = { subProductId: number; quantity: number; name: string; thumbnailUrl: string | null; price: number };
type VariantOverride = { price: string; stock: string; id?: number };

export default function ProductForm({ productId }: ProductFormProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!productId;

  const { data: product, isLoading: loadingProduct } = useGetProduct(
    productId ?? 0,
    { query: { enabled: isEdit, queryKey: getGetProductQueryKey(productId ?? 0) } }
  );
  const { data: categories } = useListCategories();
  const { data: brands } = useListBrands();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [form, setForm] = useState({
    name: "",
    nameBn: "",
    slug: "",
    description: "",
    price: "",
    originalPrice: "",
    categoryId: "",
    brandId: "",
    stock: "0",
    isActive: true,
    isFast: false,
    thumbnailUrl: "",
    images: [] as string[],
  });

  // ── Variant state: Cartesian product approach ─────────────────────────────
  const [selectedByType, setSelectedByType] = useState<Record<string, string[]>>({});
  const [deletedCombos, setDeletedCombos] = useState<Set<string>>(new Set());
  const [variantOverrides, setVariantOverrides] = useState<Record<string, VariantOverride>>({});
  const [customTypeName, setCustomTypeName] = useState("");
  const [customTypeValues, setCustomTypeValues] = useState("");
  const [customValueByType, setCustomValueByType] = useState<Record<string, string>>({});

  const allCombinations = cartesianProduct(selectedByType);
  const visibleCombinations = allCombinations.filter(data => !deletedCombos.has(comboKey(data)));

  const toggleValue = useCallback((type: string, value: string) => {
    setSelectedByType(prev => {
      const vals = prev[type] ?? [];
      const isSelected = vals.includes(value);
      const next = isSelected ? vals.filter(v => v !== value) : [...vals, value];
      if (!isSelected) {
        setDeletedCombos(d => {
          const nd = new Set(d);
          for (const key of nd) {
            if (key.includes(`${type}:${value}`)) nd.delete(key);
          }
          return nd;
        });
      }
      return { ...prev, [type]: next };
    });
  }, []);

  const addCustomType = () => {
    const typeName = customTypeName.trim();
    if (!typeName || !customTypeValues.trim()) return;
    const vals = customTypeValues.split(",").map(v => v.trim()).filter(Boolean);
    if (!vals.length) return;
    setSelectedByType(prev => ({
      ...prev,
      [typeName]: [...new Set([...(prev[typeName] ?? []), ...vals])],
    }));
    setCustomTypeName("");
    setCustomTypeValues("");
  };

  const updateOverride = (key: string, field: "price" | "stock", val: string, currentOverride: VariantOverride) => {
    setVariantOverrides(prev => ({
      ...prev,
      [key]: { ...currentOverride, ...prev[key], [field]: val },
    }));
  };

  const removeCombo = (key: string) => {
    setDeletedCombos(d => new Set([...d, key]));
  };

  // ── Sub-products state ────────────────────────────────────────────────────
  const [subProds, setSubProds] = useState<SubProdItem[]>([]);
  const [subProdSearch, setSubProdSearch] = useState("");

  useEffect(() => {
    if (isEdit && productId) {
      fetch(`${API_URL}/api/products/${productId}/sub-products`)
        .then(r => r.json())
        .then((data: any[]) => {
          if (Array.isArray(data)) {
            setSubProds(data.map(s => ({
              subProductId: s.subProductId,
              quantity: s.quantity,
              name: s.name ?? "",
              thumbnailUrl: s.thumbnailUrl ?? null,
              price: s.price ?? 0,
            })));
          }
        })
        .catch((err: any) => {
          toast({ title: "Failed to load sub-products", description: err?.message ?? "Unknown error", variant: "destructive" });
        });
    }
  }, [isEdit, productId]);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name ?? "",
        nameBn: (product as any).nameBn ?? "",
        slug: product.slug ?? "",
        description: product.description ?? "",
        price: String(product.price ?? ""),
        originalPrice: product.originalPrice ? String(product.originalPrice) : "",
        categoryId: product.categoryId ? String(product.categoryId) : "",
        brandId: product.brandId ? String(product.brandId) : "",
        stock: String(product.stock ?? 0),
        isActive: product.isActive ?? true,
        isFast: (product as any).isFast ?? false,
        thumbnailUrl: product.thumbnailUrl ?? "",
        images: product.images ?? [],
      });

      const existingVariants: any[] = (product as any).variants ?? [];
      if (existingVariants.length > 0) {
        const newSelectedByType: Record<string, string[]> = {};
        const newOverrides: Record<string, VariantOverride> = {};

        for (const v of existingVariants) {
          const data: Record<string, string> =
            v.variantData && Object.keys(v.variantData).length > 0
              ? v.variantData
              : { [v.type]: v.value };

          const key = comboKey(data);

          for (const [type, value] of Object.entries(data)) {
            if (!newSelectedByType[type]) newSelectedByType[type] = [];
            if (!newSelectedByType[type].includes(value)) {
              newSelectedByType[type].push(value);
            }
          }

          newOverrides[key] = {
            price: String((Number(product.price) || 0) + (Number(v.priceModifier) || 0)),
            stock: String(v.stock ?? 10),
            id: v.id,
          };
        }

        setSelectedByType(newSelectedByType);
        setVariantOverrides(newOverrides);
      }
    }
  }, [product]);

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === "name" && (!prev.slug || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))) {
        next.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      return next;
    });
  };

  const addImageSlot = () => setForm(prev => ({ ...prev, images: [...prev.images, ""] }));
  const setImage = (idx: number, url: string) => setForm(prev => {
    const imgs = [...prev.images];
    imgs[idx] = url;
    return { ...prev, images: imgs };
  });
  const removeImage = (idx: number) => setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));

  const { data: subProdResults } = useListProducts(
    { search: subProdSearch.trim() || undefined, limit: 8 } as any,
    { query: { enabled: subProdSearch.trim().length > 0, queryKey: getListProductsQueryKey({ search: subProdSearch.trim() || undefined, limit: 8 } as any) } }
  );
  const subProdOptions: any[] = ((subProdResults as any)?.products ?? []).filter(
    (p: any) => p.id !== productId && !subProds.find(s => s.subProductId === p.id)
  );

  const addSubProd = (p: any) => {
    setSubProds(prev => [...prev, { subProductId: p.id, quantity: 1, name: p.name, thumbnailUrl: p.thumbnailUrl ?? null, price: p.price }]);
    setSubProdSearch("");
  };

  const removeSubProd = (subProductId: number) => {
    setSubProds(prev => prev.filter(s => s.subProductId !== subProductId));
  };

  const updateSubProdQty = (subProductId: number, qty: number) => {
    setSubProds(prev => prev.map(s => s.subProductId === subProductId ? { ...s, quantity: Math.max(1, qty) } : s));
  };

  const saveSubProducts = async (pid: number) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${API_URL}/api/products/${pid}/sub-products`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subProducts: subProds.map(s => ({ subProductId: s.subProductId, quantity: s.quantity })) }),
    });
    if (!res.ok) throw new Error("Failed to save sub-products");
  };

  const saveVariants = async (pid: number) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const variants = visibleCombinations.map(data => {
      const key = comboKey(data);
      const override = variantOverrides[key] ?? { price: form.price || "0", stock: "10" };
      return {
        id: override.id,
        variantData: data,
        type: comboTypeStr(data),
        value: comboValueStr(data),
        priceModifier: (parseFloat(override.price) || 0) - (parseFloat(form.price) || 0),
        stock: parseInt(override.stock) || 0,
      };
    });

    const res = await fetch(`${API_URL}/api/products/${pid}/variants`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ variants }),
    });
    if (!res.ok) throw new Error("Failed to save variants");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(form.price);
    const stock = parseInt(form.stock, 10);
    const categoryId = parseInt(form.categoryId, 10);
    if (isNaN(price) || price < 0) { toast({ title: "Enter a valid price", variant: "destructive" }); return; }
    if (isNaN(stock) || stock < 0) { toast({ title: "Enter a valid stock quantity", variant: "destructive" }); return; }
    if (isNaN(categoryId)) { toast({ title: "Select a category", variant: "destructive" }); return; }
    const payload = {
      name: form.name,
      nameBn: form.nameBn || undefined,
      slug: form.slug,
      description: form.description || undefined,
      price,
      originalPrice: form.originalPrice ? parseFloat(form.originalPrice) : undefined,
      categoryId,
      brandId: form.brandId ? parseInt(form.brandId, 10) : undefined,
      stock,
      isActive: form.isActive,
      isFast: form.isFast,
      thumbnailUrl: form.thumbnailUrl || undefined,
      images: form.images.filter(Boolean),
    };

    if (isEdit && productId) {
      updateProduct.mutate({ id: productId, data: payload }, {
        onSuccess: async () => {
          try {
            await saveVariants(productId);
            await saveSubProducts(productId);
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast({ title: "Product updated" });
            setLocation("/products");
          } catch {
            toast({ title: "Product saved but variants/sub-products failed to save", variant: "destructive" });
          }
        },
        onError: () => toast({ title: "Failed to update product", variant: "destructive" }),
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: async (newProduct: any) => {
          try {
            await saveVariants(newProduct.id);
            await saveSubProducts(newProduct.id);
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast({ title: "Product created" });
            setLocation("/products");
          } catch {
            toast({ title: "Product created but variants/sub-products failed to save", variant: "destructive" });
          }
        },
        onError: () => toast({ title: "Failed to create product", variant: "destructive" }),
      });
    }
  };

  if (isEdit && loadingProduct) {
    return <div className="flex h-full items-center justify-center text-gray-500">Loading product...</div>;
  }

  const isPending = createProduct.isPending || updateProduct.isPending;

  const totalSelected = Object.values(selectedByType).reduce((s, vals) => s + vals.length, 0);

  return (
    <div className="space-y-6 max-w-3xl w-full">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/products")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {isEdit ? "Edit Product" : "New Product"}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
          <h3 className="text-base font-semibold text-gray-800">Basic Info</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Product Name *</label>
              <Input value={form.name} onChange={f("name")} required placeholder="e.g. Wireless Headphones" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug *</label>
              <Input value={form.slug} onChange={f("slug")} required placeholder="e.g. wireless-headphones" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">বাংলা নাম (ঐচ্ছিক)</label>
            <Input value={form.nameBn} onChange={f("nameBn")} placeholder="e.g. ওয়্যারলেস হেডফোন" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3} value={form.description} onChange={f("description")} placeholder="Product description..."
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.categoryId} onChange={f("categoryId")} required>
                <option value="">Select category</option>
                {(categories as any[])?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Brand</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.brandId} onChange={f("brandId")}>
                <option value="">No brand</option>
                {(brands as any[])?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Pricing & Stock */}
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
          <h3 className="text-base font-semibold text-gray-800">Pricing & Stock</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Sale Price (৳) *</label>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={f("price")} required placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Original Price (৳)</label>
              <Input type="number" min="0" step="0.01" value={form.originalPrice} onChange={f("originalPrice")} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock *</label>
              <Input type="number" min="0" value={form.stock} onChange={f("stock")} required />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm(p => ({ ...p, isActive: e.target.checked }))} className="h-4 w-4 rounded" />
              <label htmlFor="isActive" className="text-sm text-gray-700">Active (visible in store)</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isFast" checked={form.isFast} onChange={(e) => setForm(p => ({ ...p, isFast: e.target.checked }))} className="h-4 w-4 rounded" />
              <label htmlFor="isFast" className="text-sm text-gray-700">⚡ Flash Sale / Fast Delivery</label>
            </div>
          </div>
        </div>

        {/* Variants — Cartesian product system */}
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-600" />
              <h3 className="text-base font-semibold text-gray-800">Product Variants</h3>
            </div>
            {visibleCombinations.length > 0 && (
              <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {visibleCombinations.length} combination{visibleCombinations.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
            ⓘ একাধিক attribute-এ value select করুন — সব possible combination automatically generate হবে।
            প্রতিটি combination-এর আলাদা price ও stock রাখা যাবে।
          </p>

          {/* Preset Quick-Select with custom tag input per type */}
          <div className="space-y-3">
            {Object.entries(VARIANT_PRESETS).map(([type, presetValues]) => {
              const selected = selectedByType[type] ?? [];
              const customInput = customValueByType[type] ?? "";
              const addCustomVal = () => {
                const val = customInput.trim();
                if (!val) return;
                if (!selected.includes(val)) {
                  setSelectedByType(prev => ({ ...prev, [type]: [...(prev[type] ?? []), val] }));
                }
                setCustomValueByType(prev => ({ ...prev, [type]: "" }));
              };
              const customAdded = selected.filter(v => !presetValues.includes(v));
              return (
                <div key={type} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">{type}</p>
                    {selected.length > 0 && (
                      <button type="button" onClick={() => setSelectedByType(prev => ({ ...prev, [type]: [] }))} className="text-xs text-red-500 hover:text-red-700">
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {presetValues.map(val => {
                      const isSelected = selected.includes(val);
                      return (
                        <button key={val} type="button" onClick={() => toggleValue(type, val)}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-all ${isSelected ? "bg-blue-600 border-blue-600 text-white font-medium" : "bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50"}`}>
                          {isSelected ? "✓ " : ""}{val}
                        </button>
                      );
                    })}
                    {customAdded.map(val => (
                      <span key={val} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-purple-600 border-purple-600 text-white font-medium">
                        {val}
                        <button type="button" onClick={() => setSelectedByType(prev => ({ ...prev, [type]: (prev[type] ?? []).filter(v => v !== val) }))} className="hover:opacity-70 ml-0.5">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customInput}
                      onChange={e => setCustomValueByType(prev => ({ ...prev, [type]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomVal())}
                      placeholder={`Custom ${type.toLowerCase()} (e.g. ${type === "Color" ? "Navy Blue" : type === "Size" ? "3XL" : "Custom"})…`}
                      className="flex-1 text-xs border rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-400"
                    />
                    <button type="button" onClick={addCustomVal} className="px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 shrink-0 font-medium">
                      + Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom attribute type */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 mb-2">Custom Attribute</p>
            <div className="flex gap-2">
              <Input
                value={customTypeName}
                onChange={e => setCustomTypeName(e.target.value)}
                placeholder="Type name (e.g. Material)"
                className="text-sm h-8 w-36 shrink-0"
              />
              <Input
                value={customTypeValues}
                onChange={e => setCustomTypeValues(e.target.value)}
                placeholder="Values comma-separated (e.g. Cotton, Polyester, Silk)"
                className="text-sm h-8 flex-1"
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomType())}
              />
              <Button type="button" onClick={addCustomType} className="h-8 px-3 bg-blue-600 hover:bg-blue-700 shrink-0">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* Cartesian product combination table */}
          {totalSelected > 0 && (
            <div className="space-y-2">
              {visibleCombinations.length === 0 && allCombinations.length > 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">All combinations deleted. Deselect and re-select values to restore.</p>
              ) : visibleCombinations.length > 0 ? (
                <>
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 px-2 pt-1">
                    <div className="col-span-5">Combination</div>
                    <div className="col-span-3">Price (৳)</div>
                    <div className="col-span-3">Stock</div>
                    <div className="col-span-1"></div>
                  </div>
                  {visibleCombinations.map(data => {
                    const key = comboKey(data);
                    const override = variantOverrides[key] ?? { price: form.price || "0", stock: "10" };
                    const mergedOverride: VariantOverride = { ...override, price: (variantOverrides[key]?.price ?? form.price ?? "0"), stock: (variantOverrides[key]?.stock ?? "10") };
                    return (
                      <div key={key} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2 border">
                        <div className="col-span-5 flex flex-wrap gap-1">
                          {Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).map(([t, v]) => (
                            <span key={t} className="inline-flex items-center bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs">
                              <span className="text-gray-400 mr-0.5">{t}:</span>
                              <span className="font-medium text-gray-700">{v}</span>
                            </span>
                          ))}
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={mergedOverride.price}
                            onChange={e => updateOverride(key, "price", e.target.value, mergedOverride)}
                            className="text-sm h-8"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            min="0"
                            value={mergedOverride.stock}
                            onChange={e => updateOverride(key, "stock", e.target.value, mergedOverride)}
                            className="text-sm h-8"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeCombo(key)}
                            className="p-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}

              {visibleCombinations.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <Zap className="h-3.5 w-3.5 text-blue-500" />
                  <p className="text-xs text-gray-500">
                    {visibleCombinations.length} combination{visibleCombinations.length !== 1 ? "s" : ""} generated from{" "}
                    {Object.entries(selectedByType).filter(([, v]) => v.length > 0).map(([t, v]) => `${v.length} ${t}`).join(" × ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const basePrice = form.price || "0";
                      const newOverrides: Record<string, VariantOverride> = {};
                      for (const data of visibleCombinations) {
                        const key = comboKey(data);
                        newOverrides[key] = { ...variantOverrides[key], price: basePrice, stock: variantOverrides[key]?.stock ?? "10", id: variantOverrides[key]?.id };
                      }
                      setVariantOverrides(prev => ({ ...prev, ...newOverrides }));
                    }}
                    className="ml-auto text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Apply base price to all
                  </button>
                </div>
              )}
            </div>
          )}

          {totalSelected === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">
              Select values above to generate variant combinations.
            </p>
          )}
        </div>

        {/* Sub Products */}
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Sub Products</h3>
            <p className="text-xs text-gray-500 mt-0.5">Link other products as components of this product (e.g. a bundle or set).</p>
          </div>

          <div className="relative">
            <Input
              placeholder="Search products to add..."
              value={subProdSearch}
              onChange={e => setSubProdSearch(e.target.value)}
              className="text-sm"
            />
            {subProdOptions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {subProdOptions.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 text-left"
                    onClick={() => addSubProd(p)}
                  >
                    {p.thumbnailUrl && <img src={p.thumbnailUrl} className="w-8 h-8 rounded object-cover" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">৳{Number(p.price).toLocaleString()}</div>
                    </div>
                    <Plus className="h-4 w-4 text-blue-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {subProds.length > 0 && (
            <div className="space-y-2">
              {subProds.map(s => (
                <div key={s.subProductId} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2 border">
                  {s.thumbnailUrl && <img src={s.thumbnailUrl} className="w-10 h-10 rounded object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{s.name}</div>
                    <div className="text-xs text-gray-500">৳{Number(s.price).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <label className="text-xs text-gray-500 mr-1">Qty</label>
                    <Input
                      type="number"
                      min="1"
                      value={s.quantity}
                      onChange={e => updateSubProdQty(s.subProductId, parseInt(e.target.value) || 1)}
                      className="w-16 h-7 text-sm text-center"
                    />
                  </div>
                  <button type="button" onClick={() => removeSubProd(s.subProductId)} className="p-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 shrink-0">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-gray-400">{subProds.length} sub-product{subProds.length !== 1 ? "s" : ""} added</p>
            </div>
          )}
        </div>

        {/* Images */}
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
          <h3 className="text-base font-semibold text-gray-800">Images</h3>
          <ImageUpload label="Thumbnail (main image)" value={form.thumbnailUrl} onChange={(url) => setForm(p => ({ ...p, thumbnailUrl: url }))} />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Gallery Images</label>
              <Button type="button" variant="outline" size="sm" onClick={addImageSlot}>
                <Plus className="h-4 w-4 mr-1" /> Add Image
              </Button>
            </div>
            {form.images.map((img, idx) => (
              <div key={idx} className="relative">
                <ImageUpload value={img} onChange={(url) => setImage(idx, url)} />
                <button type="button" onClick={() => removeImage(idx)} className="absolute top-2 right-2 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 shadow z-10">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
            {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Product"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setLocation("/products")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
