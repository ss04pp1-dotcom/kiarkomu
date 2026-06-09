"use client";
import { useState } from "react";
import { Plus, Edit2, Trash2, Home, Briefcase, MapPin, Loader2, X } from "lucide-react";
import { useListAddresses, useCreateAddress, useDeleteAddress, useUpdateAddress } from "@workspace/api-client-react";
import type { Address, CreateAddressBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const EMPTY_FORM: CreateAddressBody = {
  label: "Home",
  fullName: "",
  phone: "",
  addressLine: "",
  district: "",
  area: "",
  postalCode: "",
  isDefault: false,
};

export default function AddressesPage() {
  const queryClient = useQueryClient();
  const { data: addresses = [], isLoading } = useListAddresses();
  const createMutation = useCreateAddress();
  const deleteMutation = useDeleteAddress();
  const updateMutation = useUpdateAddress();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateAddressBody>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["listAddresses"] });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      await createMutation.mutateAsync({ data: form });
      setShowModal(false);
      setForm(EMPTY_FORM);
      invalidate();
    } catch (err: unknown) {
      setFormError(
        (err as { data?: { error?: string } })?.data?.error ?? "Failed to save address.",
      );
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this address?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      invalidate();
    } catch {}
  };

  const handleSetDefault = async (addr: Address) => {
    try {
      await updateMutation.mutateAsync({
        id: addr.id,
        data: {
          label: addr.label,
          fullName: addr.fullName,
          phone: addr.phone,
          addressLine: addr.addressLine,
          district: addr.district,
          area: addr.area,
          postalCode: addr.postalCode ?? undefined,
          isDefault: true,
        },
      });
      invalidate();
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#F0185A] animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">My Addresses</h2>
        <button
          onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setFormError(""); }}
          className="flex items-center gap-2 bg-[#F0185A] hover:bg-[#c8124a] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add New Address
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(addresses as Address[]).map(addr => (
          <div key={addr.id} className={`bg-white rounded-2xl border-2 p-5 relative ${addr.isDefault ? "border-[#F0185A]" : "border-gray-100"}`}>
            {addr.isDefault && (
              <span className="absolute top-3 right-3 text-xs bg-[#F0185A] text-white px-2 py-0.5 rounded-full font-medium">
                Default
              </span>
            )}
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${addr.isDefault ? "bg-pink-50" : "bg-gray-50"}`}>
                {addr.label.toLowerCase().includes("office") || addr.label.toLowerCase().includes("work") ? (
                  <Briefcase className={`w-4 h-4 ${addr.isDefault ? "text-[#F0185A]" : "text-gray-400"}`} />
                ) : (
                  <Home className={`w-4 h-4 ${addr.isDefault ? "text-[#F0185A]" : "text-gray-400"}`} />
                )}
              </div>
              <span className="font-semibold text-gray-800 text-sm">{addr.label}</span>
            </div>
            <p className="text-sm font-medium text-gray-800">{addr.fullName}</p>
            <p className="text-sm text-gray-500 mt-0.5">{addr.phone}</p>
            <p className="text-sm text-gray-500">{addr.addressLine}</p>
            <p className="text-sm text-gray-500">
              {addr.area}, {addr.district}{addr.postalCode ? ` - ${addr.postalCode}` : ""}
            </p>
            <div className="flex gap-2 mt-4">
              <button className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-100 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => handleDelete(addr.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 text-xs text-red-500 border border-red-100 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              {!addr.isDefault && (
                <button
                  onClick={() => handleSetDefault(addr)}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-[#F0185A] hover:text-[#F0185A] transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" /> Set Default
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setFormError(""); }}
          className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-5 flex flex-col items-center justify-center gap-2 hover:border-[#F0185A] hover:text-[#F0185A] transition-colors text-gray-400 group min-h-[160px]"
        >
          <div className="w-10 h-10 bg-gray-50 group-hover:bg-pink-50 rounded-xl flex items-center justify-center transition-colors">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">Add New Address</span>
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Add New Address</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-600">{formError}</div>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Label</label>
                <select
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]"
                >
                  {(["Home", "Office", "Other"] as const).map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name</label>
                <input type="text" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required placeholder="Recipient's full name" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="+880 1X XXXX XXXX" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Address Line</label>
                <input type="text" value={form.addressLine} onChange={e => setForm(f => ({ ...f, addressLine: e.target.value }))} required placeholder="House #, Road #, Area" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">District</label>
                  <input type="text" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} required placeholder="Dhaka" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Area / Thana</label>
                  <input type="text" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} required placeholder="Dhanmondi" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Postal Code (optional)</label>
                <input type="text" value={form.postalCode ?? ""} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="1205" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={!!form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="accent-[#F0185A]" />
                Set as default address
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 py-2.5 bg-[#F0185A] hover:bg-[#c8124a] disabled:bg-gray-200 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                  {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
