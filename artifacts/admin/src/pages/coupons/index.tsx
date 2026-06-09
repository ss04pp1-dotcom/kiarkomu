import React, { useState } from "react";
import {
  useListCoupons,
  useCreateCoupon,
  useDeleteCoupon,
  useUpdateCoupon,
  getListCouponsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Pencil,
  X,
  Tag,
  Calendar,
  ShoppingCart,
  Hash,
  CheckCircle2,
  XCircle,
  Percent,
  BadgeDollarSign,
} from "lucide-react";

const EMPTY_FORM = {
  code: "",
  type: "percent" as "percent" | "fixed",
  value: "",
  minOrder: "",
  maxUses: "",
  expiresAt: "",
};

type CouponForm = typeof EMPTY_FORM;

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" });
}

function isExpired(iso: string | null) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

export default function Coupons() {
  const { data, isLoading } = useListCoupons();
  const createCoupon = useCreateCoupon();
  const deleteCoupon = useDeleteCoupon();
  const updateCoupon = useUpdateCoupon();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);

  const coupons: any[] = (data as any)?.coupons ?? (Array.isArray(data) ? data : []);

  const isEditing = editingId !== null;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      minOrder: c.minOrderAmount ? String(c.minOrderAmount) : "",
      maxUses: c.maxUses ? String(c.maxUses) : "",
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(form.value);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Value must be a positive number", variant: "destructive" });
      return;
    }
    if (form.type === "percent" && val > 100) {
      toast({ title: "Percentage cannot exceed 100%", variant: "destructive" });
      return;
    }

    const payload: any = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: val,
      minOrderAmount: form.minOrder ? parseFloat(form.minOrder) : undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses, 10) : undefined,
      expiresAt: form.expiresAt || undefined,
    };

    if (isEditing) {
      updateCoupon.mutate(
        { id: editingId!, data: payload as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
            toast({ title: "Coupon updated" });
            resetForm();
          },
          onError: (err: any) =>
            toast({ title: err?.data?.error ?? "Failed to update coupon", variant: "destructive" }),
        },
      );
    } else {
      createCoupon.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
            toast({ title: "Coupon created" });
            resetForm();
          },
          onError: (err: any) =>
            toast({ title: err?.data?.error ?? "Failed to create coupon", variant: "destructive" }),
        },
      );
    }
  };

  const toggleActive = (c: any) => {
    updateCoupon.mutate(
      { id: c.id, data: { isActive: !c.isActive } as any },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() }),
        onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    deleteCoupon.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
          toast({ title: "Coupon deleted" });
          if (editingId === id) resetForm();
        },
        onError: () => toast({ title: "Failed to delete coupon", variant: "destructive" }),
      },
    );
  };

  const isBusy = createCoupon.isPending || updateCoupon.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Coupons</h2>
          <p className="text-sm text-gray-500 mt-1">Create and manage discount codes for your customers</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{coupons.length}</span> total
          <span className="mx-1">·</span>
          <span className="font-semibold text-green-600">{coupons.filter((c: any) => c.isActive).length}</span> active
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-6 items-start">
        {/* ── Create / Edit Form ── */}
        <div className="xl:col-span-1">
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            {/* Form header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isEditing ? "bg-amber-50" : "bg-gray-50"}`}>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <Pencil className="h-4 w-4 text-amber-600" />
                ) : (
                  <Plus className="h-4 w-4 text-gray-600" />
                )}
                <span className="font-semibold text-gray-900 text-sm">
                  {isEditing ? `Edit — ${form.code}` : "New Coupon"}
                </span>
              </div>
              {isEditing && (
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Code */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  <Tag className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Coupon Code
                </label>
                <Input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, "") }))}
                  required
                  placeholder="SUMMER20"
                  className="font-mono font-bold tracking-widest"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-uppercased. No spaces allowed.</p>
              </div>

              {/* Type + Value row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Type
                  </label>
                  <select
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as "percent" | "fixed" }))}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    {form.type === "percent" ? (
                      <><Percent className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Value (%)</>
                    ) : (
                      <><BadgeDollarSign className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Value (৳)</>
                    )}
                  </label>
                  <Input
                    type="number"
                    min="0.01"
                    max={form.type === "percent" ? "100" : undefined}
                    step="0.01"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    required
                    placeholder={form.type === "percent" ? "20" : "100"}
                  />
                </div>
              </div>

              {/* Min Order */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  <ShoppingCart className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Min Order Amount (৳)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.minOrder}
                  onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))}
                  placeholder="Optional — e.g. 500"
                />
              </div>

              {/* Max Uses */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  <Hash className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Max Uses
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxUses}
                  onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                  placeholder="Optional — leave blank for unlimited"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  <Calendar className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Expiry Date
                </label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Optional — leave blank for no expiry.</p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={isBusy} className="flex-1">
                  {isBusy ? (
                    <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</span>
                  ) : isEditing ? (
                    <><Pencil className="h-4 w-4 mr-1.5" /> Save Changes</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-1.5" /> Create Coupon</>
                  )}
                </Button>
                {isEditing && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* ── Coupon Table ── */}
        <div className="xl:col-span-2">
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading coupons…</p>
              </div>
            ) : coupons.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Tag className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No coupons yet</p>
                <p className="text-xs text-gray-400 mt-1">Create your first coupon using the form.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3.5">Code</th>
                      <th className="px-5 py-3.5">Discount</th>
                      <th className="px-5 py-3.5">Min Order</th>
                      <th className="px-5 py-3.5">Uses</th>
                      <th className="px-5 py-3.5">Expires</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coupons.map((c: any) => {
                      const expired = isExpired(c.expiresAt);
                      const isEditRow = editingId === c.id;
                      return (
                        <tr
                          key={c.id}
                          className={`transition-colors ${isEditRow ? "bg-amber-50" : "hover:bg-gray-50"}`}
                        >
                          {/* Code */}
                          <td className="px-5 py-4">
                            <span className={`font-mono font-bold text-sm tracking-wider px-2 py-0.5 rounded ${isEditRow ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-800"}`}>
                              {c.code}
                            </span>
                          </td>

                          {/* Discount */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              {c.type === "percent" ? (
                                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">%</span>
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">৳</span>
                              )}
                              <span className="font-semibold text-gray-900">
                                {c.type === "percent" ? `${c.value}%` : `৳${c.value}`}
                              </span>
                            </div>
                          </td>

                          {/* Min Order */}
                          <td className="px-5 py-4 text-gray-500 text-sm">
                            {c.minOrderAmount ? `৳${c.minOrderAmount}` : <span className="text-gray-300">—</span>}
                          </td>

                          {/* Uses */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1 text-sm">
                              <span className="font-semibold text-gray-900">{c.usedCount ?? 0}</span>
                              {c.maxUses ? (
                                <>
                                  <span className="text-gray-400">/</span>
                                  <span className="text-gray-500">{c.maxUses}</span>
                                  {/* Usage bar */}
                                  <div className="ml-1 w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${(c.usedCount ?? 0) >= c.maxUses ? "bg-red-500" : "bg-green-500"}`}
                                      style={{ width: `${Math.min(100, ((c.usedCount ?? 0) / c.maxUses) * 100)}%` }}
                                    />
                                  </div>
                                </>
                              ) : (
                                <span className="text-gray-300 text-xs">∞</span>
                              )}
                            </div>
                          </td>

                          {/* Expiry */}
                          <td className="px-5 py-4">
                            {c.expiresAt ? (
                              <span className={`text-sm flex items-center gap-1 ${expired ? "text-red-500" : "text-gray-600"}`}>
                                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                                {formatDate(c.expiresAt)}
                                {expired && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1 py-0.5 rounded ml-0.5">EXPIRED</span>}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-sm">No expiry</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <Badge
                              variant={c.isActive && !expired ? "default" : "secondary"}
                              className={c.isActive && !expired ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200" : ""}
                            >
                              {expired ? "Expired" : c.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {/* Edit */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => isEditRow ? resetForm() : startEdit(c)}
                                title={isEditRow ? "Cancel edit" : "Edit"}
                                className={isEditRow ? "text-amber-600 hover:text-amber-700 hover:bg-amber-100" : "text-gray-500 hover:text-gray-700"}
                              >
                                {isEditRow ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                              </Button>

                              {/* Toggle active */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleActive(c)}
                                title={c.isActive ? "Deactivate" : "Activate"}
                              >
                                {c.isActive ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-gray-400" />
                                )}
                              </Button>

                              {/* Delete */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDelete(c.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary chips */}
          {coupons.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <div className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {coupons.filter((c: any) => c.isActive && !isExpired(c.expiresAt)).length} active
              </div>
              <div className="text-xs bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" />
                {coupons.filter((c: any) => !c.isActive).length} inactive
              </div>
              {coupons.some((c: any) => isExpired(c.expiresAt)) && (
                <div className="text-xs bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {coupons.filter((c: any) => isExpired(c.expiresAt)).length} expired
                </div>
              )}
              <div className="text-xs bg-blue-50 border border-blue-200 text-blue-600 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                {coupons.reduce((s: number, c: any) => s + (c.usedCount ?? 0), 0)} total uses
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
