import React, { useState } from "react";
import { useListBanners, useCreateBanner, useDeleteBanner, useUpdateBanner, getListBannersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/image-upload";
import { Plus, Trash2, Pencil, X, Check, Image as ImageIcon } from "lucide-react";

type Banner = { id: number; title: string; imageUrl: string; dominantColor?: string | null; linkUrl?: string | null; position: number };

export default function Banners() {
  const { data: banners, isLoading } = useListBanners();
  const createBanner = useCreateBanner();
  const deleteBanner = useDeleteBanner();
  const updateBanner = useUpdateBanner();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({ title: "", imageUrl: "", dominantColor: "", linkUrl: "", position: "0" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", imageUrl: "", dominantColor: "", linkUrl: "", position: "0" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl) { toast({ title: "Please upload a banner image", variant: "destructive" }); return; }

    createBanner.mutate(
      { data: { title: form.title, imageUrl: form.imageUrl, dominantColor: form.dominantColor || undefined, linkUrl: form.linkUrl || undefined, position: parseInt(form.position) } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBannersQueryKey() });
          setForm({ title: "", imageUrl: "", dominantColor: "", linkUrl: "", position: "0" });
          toast({ title: "Banner created" });
        },
        onError: () => toast({ title: "Failed to create banner", variant: "destructive" }),
      }
    );
  };

  const startEdit = (b: Banner) => {
    setEditId(b.id);
    setEditForm({ title: b.title, imageUrl: b.imageUrl, dominantColor: b.dominantColor || "", linkUrl: b.linkUrl ?? "", position: String(b.position) });
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = (id: number) => {
    updateBanner.mutate(
      { id, data: { title: editForm.title, imageUrl: editForm.imageUrl, dominantColor: editForm.dominantColor || undefined, linkUrl: editForm.linkUrl || undefined, position: parseInt(editForm.position) } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBannersQueryKey() });
          setEditId(null);
          toast({ title: "Banner updated" });
        },
        onError: () => toast({ title: "Failed to update banner", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this banner?")) return;
    deleteBanner.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBannersQueryKey() });
        toast({ title: "Banner deleted" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900">Banners</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4">Add Banner</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Summer Sale" />
              </div>

              <ImageUpload
                label="Banner Image"
                value={form.imageUrl}
                onChange={(url) => setForm(f => ({ ...f, imageUrl: url }))}
                onDominantColor={(color) => setForm(f => ({ ...f, dominantColor: color }))}
              />

              {form.dominantColor && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Theme Color:</span>
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: form.dominantColor }}></div>
                  <span>{form.dominantColor}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Link URL <span className="text-gray-400 font-normal">(optional)</span></label>
                <Input value={form.linkUrl} onChange={(e) => setForm(f => ({ ...f, linkUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sort Order</label>
                <Input type="number" value={form.position} onChange={(e) => setForm(f => ({ ...f, position: e.target.value }))} />
              </div>
              <Button type="submit" disabled={createBanner.isPending} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add Banner
              </Button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="space-y-4">
            {isLoading ? (
              <div className="rounded-xl border bg-white p-8 text-center text-gray-500">Loading...</div>
            ) : (banners as any[])?.length ? (
              (banners as any[]).map((b: Banner) => (
                <div key={b.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  {editId === b.id ? (
                    <div className="p-5 space-y-4">
                      <ImageUpload
                        label="Banner Image"
                        value={editForm.imageUrl}
                        onChange={(url) => setEditForm(f => ({ ...f, imageUrl: url }))}
                        onDominantColor={(color) => setEditForm(f => ({ ...f, dominantColor: color }))}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Title</label>
                          <Input value={editForm.title} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Sort Order</label>
                          <Input type="number" value={editForm.position} onChange={(e) => setEditForm(f => ({ ...f, position: e.target.value }))} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Link URL</label>
                        <Input value={editForm.linkUrl} onChange={(e) => setEditForm(f => ({ ...f, linkUrl: e.target.value }))} className="h-8 text-sm" placeholder="https://..." />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(b.id)} disabled={updateBanner.isPending}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex">
                      <div className="w-44 h-24 bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {b.imageUrl ? <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" /> : <ImageIcon className="h-8 w-8 text-gray-300" />}
                      </div>
                      <div className="flex-1 p-4 flex items-center justify-between min-w-0">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{b.title}</p>
                          {b.linkUrl && <p className="text-xs text-gray-500 mt-0.5 truncate">{b.linkUrl}</p>}
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            Order: {b.position}
                            {b.dominantColor && (
                              <><span className="mx-1">•</span> Color: <span className="w-3 h-3 rounded-full inline-block border" style={{ backgroundColor: b.dominantColor }}></span></>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-50" onClick={() => startEdit(b)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(b.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-xl border bg-white p-8 text-center text-gray-500">No banners yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
