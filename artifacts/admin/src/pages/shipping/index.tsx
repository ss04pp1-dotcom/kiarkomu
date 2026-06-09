import React, { useState } from "react";
import { useListShippingZones, useCreateShippingZone, useDeleteShippingZone, getListShippingZonesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Truck } from "lucide-react";

export default function Shipping() {
  const { data: zones, isLoading } = useListShippingZones();
  const createZone = useCreateShippingZone();
  const deleteZone = useDeleteShippingZone();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({ name: "", fee: "", estimatedDays: "2" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createZone.mutate(
      { data: { name: form.name, fee: parseFloat(form.fee), estimatedDays: parseInt(form.estimatedDays), districts: [] } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListShippingZonesQueryKey() });
          setForm({ name: "", fee: "", estimatedDays: "2" });
          toast({ title: "Shipping zone created" });
        },
        onError: () => toast({ title: "Failed to create zone", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this shipping zone?")) return;
    deleteZone.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListShippingZonesQueryKey() });
        toast({ title: "Zone deleted" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
        <Truck className="h-7 w-7" /> Shipping Zones
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4">Add Zone</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Zone Name</label>
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Dhaka City" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fee (৳)</label>
                <Input type="number" min="0" value={form.fee} onChange={(e) => setForm(f => ({ ...f, fee: e.target.value }))} required placeholder="60" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Delivery Days</label>
                <Input type="number" min="1" value={form.estimatedDays} onChange={(e) => setForm(f => ({ ...f, estimatedDays: e.target.value }))} required />
              </div>
              <Button type="submit" disabled={createZone.isPending} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add Zone
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
                    <th className="px-6 py-4">Zone Name</th>
                    <th className="px-6 py-4">Fee</th>
                    <th className="px-6 py-4">Est. Delivery</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(zones as any[])?.map((z: any) => (
                    <tr key={z.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{z.name}</td>
                      <td className="px-6 py-4 font-semibold text-blue-600">৳{z.fee}</td>
                      <td className="px-6 py-4 text-gray-500">{z.estimatedDays} day{z.estimatedDays !== 1 ? "s" : ""}</td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(z.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!(zones as any[])?.length && (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No shipping zones yet</td></tr>
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
