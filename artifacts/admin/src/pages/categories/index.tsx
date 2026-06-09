import React, { useState, useMemo } from "react";
import { useListCategories, useCreateCategory, useDeleteCategory, useUpdateCategory, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/image-upload";
import { Plus, Trash2, Pencil, X, Check, Image as ImageIcon, ChevronRight, ChevronDown, FolderOpen } from "lucide-react";

type ApiCategory = {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
  productCount: number;
  parentId?: number | null;
};

type CategoryNode = ApiCategory & { children: CategoryNode[] };

function buildTree(cats: ApiCategory[]): CategoryNode[] {
  const map: Record<number, CategoryNode> = {};
  for (const c of cats) map[c.id] = { ...c, children: [] };
  const roots: CategoryNode[] = [];
  for (const c of cats) {
    if (c.parentId && map[c.parentId]) {
      map[c.parentId].children.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  }
  return roots;
}

export default function Categories() {
  const { data: categoriesRaw = [], isLoading } = useListCategories();
  const categories = categoriesRaw as ApiCategory[];
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const updateCategory = useUpdateCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [parentId, setParentId] = useState<number | "">("");

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editParentId, setEditParentId] = useState<number | "">("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const tree = useMemo(() => buildTree(categories), [categories]);
  const parentOptions = useMemo(() => categories.filter(c => !c.parentId), [categories]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const autoSlug = (n: string) => n.toLowerCase().replace(/\s+&\s+/g, "-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createCategory.mutate(
      { data: { name, slug, imageUrl: imageUrl || undefined, parentId: parentId || undefined } as any },
      {
        onSuccess: () => {
          invalidate();
          setName(""); setSlug(""); setImageUrl(""); setParentId("");
          toast({ title: "Category created" });
        },
        onError: () => toast({ title: "Failed to create", variant: "destructive" }),
      }
    );
  };

  const startEdit = (cat: ApiCategory) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditImageUrl(cat.imageUrl ?? "");
    setEditParentId(cat.parentId ?? "");
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = (id: number) => {
    updateCategory.mutate(
      { id, data: { name: editName, slug: editSlug, imageUrl: editImageUrl || undefined, parentId: editParentId || null } as any },
      {
        onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Category updated" }); },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This will also remove all its subcategories from the tree.`)) return;
    deleteCategory.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "Category deleted" }); }
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const EditRow = ({ cat, depth = 0 }: { cat: ApiCategory; depth?: number }) => (
    <tr key={`edit-${cat.id}`} className="hover:bg-gray-50">
      <td colSpan={5} className="px-4 py-4">
        <div className="space-y-3" style={{ marginLeft: depth * 24 }}>
          <ImageUpload label="Image" value={editImageUrl} onChange={setEditImageUrl} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Name</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Slug</label>
              <Input value={editSlug} onChange={e => setEditSlug(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Parent Category (leave empty for top-level)</label>
            <select
              value={editParentId}
              onChange={e => setEditParentId(e.target.value ? Number(e.target.value) : "")}
              className="h-8 text-sm border border-gray-200 rounded-md px-2 w-full"
            >
              <option value="">— Top-level category —</option>
              {parentOptions.filter(p => p.id !== cat.id).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveEdit(cat.id)} disabled={updateCategory.isPending}>
              <Check className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );

  const CategoryRow = ({ cat, depth = 0 }: { cat: CategoryNode; depth?: number }) => {
    const hasChildren = cat.children.length > 0;
    const isExpanded = expandedIds.has(cat.id);
    return (
      <>
        {editId === cat.id ? (
          <EditRow cat={cat} depth={depth} />
        ) : (
          <tr className="hover:bg-gray-50">
            <td className="px-4 py-3">
              <div className="h-9 w-9 rounded bg-gray-100 border flex items-center justify-center overflow-hidden">
                {cat.imageUrl
                  ? <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                  : <ImageIcon className="h-4 w-4 text-gray-400" />}
              </div>
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
                {hasChildren ? (
                  <button onClick={() => toggleExpand(cat.id)} className="p-0.5 hover:bg-gray-200 rounded">
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                      : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                  </button>
                ) : depth > 0 ? (
                  <span className="w-5 flex items-center justify-center">
                    <ChevronRight className="h-3 w-3 text-gray-300" />
                  </span>
                ) : null}
                <span className={`font-medium text-sm ${depth > 0 ? "text-gray-600" : "text-gray-900"}`}>
                  {cat.name}
                </span>
                {hasChildren && (
                  <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {cat.children.length}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 pl-6 mt-0.5" style={{ paddingLeft: depth * 20 + 24 }}>
                {cat.slug}
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">{cat.productCount}</td>
            <td className="px-4 py-3 text-sm text-gray-400">
              {depth === 0 ? "Top-level" : "Subcategory"}
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-50" onClick={() => startEdit(cat)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(cat.id, cat.name)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </td>
          </tr>
        )}
        {hasChildren && isExpanded && cat.children.map(child => (
          <CategoryRow key={child.id} cat={child} depth={depth + 1} />
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900">Categories</h2>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4">Add Category</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <ImageUpload label="Category Image" value={imageUrl} onChange={setImageUrl} />
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  value={name}
                  onChange={e => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }}
                  required
                  placeholder="e.g. Mobiles & Tablets"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <Input value={slug} onChange={e => setSlug(e.target.value)} required placeholder="e.g. mobiles-tablets" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parent Category</label>
                <select
                  value={parentId}
                  onChange={e => setParentId(e.target.value ? Number(e.target.value) : "")}
                  className="h-10 text-sm border border-gray-200 rounded-md px-3 w-full"
                >
                  <option value="">— Top-level category —</option>
                  {parentOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Select a parent to create a subcategory</p>
              </div>
              <Button type="submit" disabled={createCategory.isPending} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add Category
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
                      <th className="px-4 py-4">Image</th>
                      <th className="px-4 py-4">Name / Slug</th>
                      <th className="px-4 py-4">Products</th>
                      <th className="px-4 py-4">Type</th>
                      <th className="px-4 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tree.map(cat => (
                      <CategoryRow key={cat.id} cat={cat} depth={0} />
                    ))}
                    {!tree.length && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <FolderOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No categories yet. Add your first one!</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2 px-1">
            Click <ChevronRight className="inline h-3 w-3" /> to expand parent categories and see their subcategories.
          </p>
        </div>
      </div>
    </div>
  );
}
