import React, { useState } from "react";
import { useListStores, useCreateStore, getListStoresQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Clock, Phone } from "lucide-react";

export default function Stores() {
  const { data: stores, isLoading } = useListStores();
  const createStore = useCreateStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    phone: "",
    openingHours: "Sat–Thu: 10:00 AM – 9:00 PM",
    lat: "",
    long: "",
  });

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const fullAddress = form.city ? `${form.address}, ${form.city}` : form.address;
    createStore.mutate(
      {
        data: {
          name: form.name,
          address: fullAddress,
          phone: form.phone,
          openingHours: form.openingHours,
          lat: form.lat ? parseFloat(form.lat) : 0,
          long: form.long ? parseFloat(form.long) : 0,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() });
          setForm({ name: "", address: "", city: "", phone: "", openingHours: "Sat–Thu: 10:00 AM – 9:00 PM", lat: "", long: "" });
          toast({ title: "Store created" });
        },
        onError: (err: any) => {
          const msg = err?.data?.error || "Failed to create store";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
        <MapPin className="h-7 w-7" /> Stores / Pickup Points
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4">Add Store</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Store Name *</label>
                <Input value={form.name} onChange={f("name")} required placeholder="Dhanmondi Branch" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address *</label>
                <Input value={form.address} onChange={f("address")} required placeholder="Road 27, House 5" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City *</label>
                <Input value={form.city} onChange={f("city")} required placeholder="Dhaka" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone *</label>
                <Input value={form.phone} onChange={f("phone")} required placeholder="01XXXXXXXXX" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Opening Hours *</label>
                <Input value={form.openingHours} onChange={f("openingHours")} required placeholder="Sat–Thu: 10 AM – 9 PM" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Latitude</label>
                  <Input type="number" step="any" value={form.lat} onChange={f("lat")} placeholder="23.8103" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Longitude</label>
                  <Input type="number" step="any" value={form.long} onChange={f("long")} placeholder="90.4125" />
                </div>
              </div>
              <p className="text-xs text-gray-400">Lat/Long optional — used for map pin</p>
              <Button type="submit" disabled={createStore.isPending} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> {createStore.isPending ? "Creating..." : "Add Store"}
              </Button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="grid gap-4">
            {isLoading ? (
              <div className="rounded-xl border bg-white p-8 text-center text-gray-500">Loading...</div>
            ) : (stores as any[])?.length ? (
              (stores as any[]).map((s: any) => (
                <div key={s.id} className="rounded-xl border bg-white p-5 shadow-sm flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-blue-50 flex-shrink-0">
                    <MapPin className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" /> {s.address}
                    </p>
                    {s.openingHours && (
                      <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" /> {s.openingHours}
                      </p>
                    )}
                    {s.phone && (
                      <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" /> {s.phone}
                      </p>
                    )}
                    {(s.lat !== 0 || s.long !== 0) && (
                      <p className="text-xs text-gray-400 mt-1">{s.lat}, {s.long}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border bg-white p-8 text-center text-gray-500">No stores yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
