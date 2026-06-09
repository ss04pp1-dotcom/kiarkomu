import React, { useState } from "react";
import { useListBrands, useCreateBrand, useDeleteBrand, useUpdateBrand, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/image-upload";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";

type Brand = { id: number; name: string; logoUrl?: string | null; productCount: number };

export default function Brands() {
  const { data: brands, isLoading } = useListBrands();
  const createBrand = useCreateBrand();
  const deleteBrand = useDeleteBrand();
  const updateBrand = useUpdateBrand();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createBrand.mutate(
      { data: { name, logoUrl: logoUrl || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
          setName(""); setLogoUrl("");
          toast({ title: "Brand created" });
        },
        onError: () => toast({ title: "Failed to create brand", variant: "destructive" }),
      }
    );
  };

  const startEdit = (b: Brand) => {
    setEditId(b.id);
    setEditName(b.name);
    setEditLogoUrl(b.logoUrl ?? "");
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = (id: number) => {
    updateBrand.mutate(
      { id, data: { name: editName, logoUrl: editLogoUrl || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
          setEditId(null);
          toast({ title: "Brand updated" });
        },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this brand?")) return;
    deleteBrand.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
        toast({ title: "Brand deleted" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900">Brands</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4">Add Brand</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <ImageUpload label="Brand Logo" value={logoUrl} onChange={setLogoUrl} />
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <Button type="submit" disabled={createBrand.isPending} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add Brand
              </Button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-4">Logo</th>
                    <th className="px-4 py-4">Name</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {brands?.map((brand) => (
                    <tr key={brand.id} className="hover:bg-gray-50">
                      {editId === brand.id ? (
                        <td colSpan={3} className="px-4 py-4">
                          <div className="space-y-3">
                            <ImageUpload label="Logo" value={editLogoUrl} onChange={setEditLogoUrl} />
                            <div>
                              <label className="block text-xs font-medium mb-1">Name</label>
                              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveEdit(brand.id)} disabled={updateBrand.isPending}>
                                <Check className="h-3.5 w-3.5 mr-1" /> Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                <X className="h-3.5 w-3.5 mr-1" /> Cancel
                              </Button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-4">
                            <div className="h-10 w-10 rounded bg-gray-100 border flex items-center justify-center overflow-hidden">
                              {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain p-1" /> : <span className="text-xs font-bold text-gray-400">{brand.name[0]}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4 font-medium">{brand.name}</td>
                          <td className="px-4 py-4 text-right flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-50" onClick={() => startEdit(brand)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(brand.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {!brands?.length && (
                    <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No brands yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
