import React, { useState } from "react";
import { Link } from "wouter";
import {
  useListOrders,
  useGetOrder,
  useUpdateOrderStatus,
  useAddTrackingEvent,
  getGetOrderQueryKey,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search, X, Package, MapPin, Truck, User, Calendar,
  ExternalLink, Clock, CheckCircle2, ChevronRight, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAY_METHOD_LABEL: Record<string, string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  card: "Card",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  packing: "bg-indigo-50 text-indigo-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  out_for_delivery: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-gray-100 text-gray-800",
};

const STATUS_OPTIONS = [
  "pending", "confirmed", "packing", "shipped",
  "out_for_delivery", "delivered", "cancelled", "returned",
];

function TrackingTimeline({ events }: { events: Array<{ id: number; status: string; timestamp: string }> }) {
  if (!events.length) return (
    <p className="text-sm text-gray-400 py-2">No tracking events yet.</p>
  );
  return (
    <ol className="space-y-3">
      {[...events].reverse().map((e, i) => (
        <li key={e.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
              i === 0 ? "bg-blue-600" : "bg-gray-200"
            )}>
              {i === 0
                ? <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                : <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />}
            </div>
            {i < events.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
          </div>
          <div className="pb-3">
            <p className={cn("text-sm font-medium capitalize", i === 0 ? "text-blue-700" : "text-gray-700")}>
              {e.status.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(e.timestamp).toLocaleString("en-GB", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function OrderDrawer({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { queryKey: getGetOrderQueryKey(orderId) },
  });
  const updateStatus = useUpdateOrderStatus();
  const addTracking = useAddTrackingEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [trackingNote, setTrackingNote] = useState("");

  const handleStatusChange = (newStatus: string) => {
    updateStatus.mutate(
      { id: orderId, data: { status: newStatus as any } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetOrderQueryKey(orderId), (old: any) =>
            old ? { ...old, status: updated.status } : old
          );
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          toast({ title: "Status updated" });
        },
        onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
      }
    );
  };

  const handleAddTracking = () => {
    if (!trackingNote.trim()) return;
    addTracking.mutate(
      { id: orderId, data: { status: trackingNote.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
          setTrackingNote("");
          toast({ title: "Tracking event added" });
        },
        onError: () => toast({ title: "Failed to add tracking event", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" aria-hidden />
      <aside
        className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">
              {isLoading ? "Loading…" : `Order #${order?.id}`}
            </h3>
            {order && (
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"
              )}>
                {order.status.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/orders/${orderId}`}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 transition-colors"
              title="Open full page"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !order ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Order not found</div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y">
            {/* Status update */}
            <div className="px-6 py-4 bg-blue-50/40">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Update Status</p>
              <Select value={order.status} onValueChange={handleStatusChange} disabled={updateStatus.isPending}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Order items */}
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Items
              </p>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-3 items-center">
                    <div className="h-12 w-12 rounded-lg bg-gray-100 border overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {item.thumbnailUrl
                        ? <img src={item.thumbnailUrl} alt={item.productName} className="h-full w-full object-cover" />
                        : <Package className="h-5 w-5 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                      {item.variantLabel && <p className="text-xs text-gray-500">{item.variantLabel}</p>}
                      <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">৳{(Number(item.price) * item.quantity).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">৳{Number(item.price).toLocaleString()} ea.</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-4 pt-4 border-t space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span><span>৳{Number(order.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span><span>৳{Number(order.shippingFee).toLocaleString()}</span>
                </div>
                {Number(order.discount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount{Number(order.coinsUsed) > 0 ? ` (incl. ${order.coinsUsed} coins)` : ""}</span>
                    <span>−৳{Number(order.discount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t mt-2">
                  <span>Total</span><span>৳{Number(order.total).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Customer + Shipping */}
            <div className="px-6 py-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Customer & Delivery
              </p>
              <div className="flex items-start gap-3 text-sm">
                <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">{order.userName}</p>
                  <p className="text-gray-500">
                    {new Date(order.createdAt).toLocaleString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 capitalize">
                    {order.deliveryMethod.replace(/_/g, " ")}
                  </p>
                  {order.address ? (
                    <p className="text-gray-500 mt-0.5 leading-snug">
                      {order.address.fullName} · {order.address.phone}<br />
                      {order.address.addressLine}, {order.address.area}, {order.address.district}
                    </p>
                  ) : order.storeName ? (
                    <p className="text-gray-500 mt-0.5">Pickup: {order.storeName}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Truck className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div>
                  <span className="font-medium text-gray-900">{PAY_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
                  {" · "}
                  <span className={order.paymentStatus === "paid" ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
                    {order.paymentStatus === "paid"
                      ? (order.payDeliveryCharge ? "delivery fee paid" : "paid")
                      : order.paymentStatus}
                  </span>
                  {order.couponCode && (
                    <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                      {order.couponCode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tracking timeline */}
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Tracking
              </p>
              <TrackingTimeline events={order.tracking ?? []} />
              <div className="flex gap-2 mt-4">
                <Input
                  placeholder="Add tracking note…"
                  value={trackingNote}
                  onChange={(e) => setTrackingNote(e.target.value)}
                  className="text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTracking(); }}
                />
                <Button
                  size="sm"
                  onClick={handleAddTracking}
                  disabled={!trackingNote.trim() || addTracking.isPending}
                  className="flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: ordersPage, isLoading } = useListOrders({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const displayedOrders = (ordersPage?.orders ?? []).filter((order) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(order.id).includes(q) ||
      (order.userName ?? "").toLowerCase().includes(q) ||
      order.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {selectedOrderId !== null && (
        <OrderDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Orders</h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Search orders..."
            className="pl-9 bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-orders"
          />
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="bg-white border w-full justify-start rounded-lg p-1 h-auto flex-wrap gap-1">
          {["all", "pending", "confirmed", "packing", "shipped", "out_for_delivery", "delivered", "cancelled"].map((s) => (
            <TabsTrigger key={s} value={s} className="rounded-md capitalize text-xs sm:text-sm">
              {s === "all" ? "All Orders" : s.replace(/_/g, " ")}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p>Loading orders…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-600 font-medium border-b">
                <tr>
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedOrders.length ? (
                  displayedOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <td className="px-6 py-4 font-mono font-semibold text-gray-700">
                        #{order.id}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 flex items-center gap-1">
                          {order.userName}
                          <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-medium capitalize",
                          STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"
                        )}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{PAY_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</div>
                        <div className={cn(
                          "text-xs",
                          order.paymentStatus === "paid" ? "text-green-600" : "text-yellow-600"
                        )}>
                          {order.paymentStatus === "paid"
                            ? (order.payDeliveryCharge ? "delivery fee paid" : "paid")
                            : order.paymentStatus}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">৳{Number(order.total).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/orders/${order.id}`}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 hover:underline transition-colors"
                          data-testid={`view-order-${order.id}`}
                        >
                          Full page <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-8 w-8 text-gray-300" />
                        <p>No orders found matching this criteria</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 text-center">Click any row to view order details in the side panel</p>
    </div>
  );
}
