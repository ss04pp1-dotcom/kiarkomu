"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Search, Package, Loader2 } from "lucide-react";
import { useListOrders } from "@workspace/api-client-react";
import type { OrderStatus } from "@workspace/api-client-react";

const STATUS_TABS: Array<{ label: string; value: OrderStatus | "all" }> = [
  { label: "All",       value: "all" },
  { label: "Pending",   value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Shipped",   value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const STATUS_COLORS: Record<string, string> = {
  pending:          "bg-amber-50 text-amber-600",
  confirmed:        "bg-blue-50 text-blue-600",
  packing:          "bg-blue-50 text-blue-600",
  shipped:          "bg-orange-50 text-orange-600",
  out_for_delivery: "bg-orange-50 text-orange-600",
  delivered:        "bg-green-50 text-green-600",
  cancelled:        "bg-red-50 text-red-600",
  returned:         "bg-gray-50 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", packing: "Packing",
  shipped: "Shipped", out_for_delivery: "Out for Delivery",
  delivered: "Delivered", cancelled: "Cancelled", returned: "Returned",
};

function formatPrice(n: number) { return `৳${n.toLocaleString("en-BD")}`; }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" });
}

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useListOrders(
    { page: 1, limit: 50, ...(activeTab !== "all" ? { status: activeTab } : {}) },
  );

  const orders = data?.orders ?? [];
  type OrderSummary = (typeof orders)[number];
  const filtered = search.trim()
    ? orders.filter((o: OrderSummary) =>
        o.id.toString().includes(search.trim()) ||
        (STATUS_LABELS[o.status] ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : orders;

  return (
    <div className="space-y-4">
      {/* Header — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h2 className="text-xl font-bold text-gray-900">My Orders</h2>
        <div className="relative sm:ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by order ID..."
            className="w-full sm:w-56 pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#F0185A]"
          />
        </div>
      </div>

      {/* Status tabs — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              activeTab === tab.value
                ? "bg-[#F0185A] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-[#F0185A] hover:text-[#F0185A]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#F0185A] animate-spin" />
        </div>
      )}
      {error && (
        <div className="text-center py-12 text-red-500 text-sm">Failed to load orders.</div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-2">No orders found</p>
          <Link href="/" className="text-sm text-[#F0185A] hover:underline">Start shopping</Link>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((order: OrderSummary) => (
          <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            {/* Order header */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-50">
              <div>
                <p className="text-xs text-gray-400">Order ID</p>
                <p className="text-sm font-bold text-gray-800">#{order.id}</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs text-gray-400">Date</p>
                <p className="text-sm text-gray-700">{formatDate(order.createdAt)}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-50 text-gray-500"}`}>
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
            </div>

            {/* Order body */}
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 sm:hidden">{formatDate(order.createdAt)}</p>
                <p className="text-sm text-gray-500 capitalize">{order.deliveryMethod.replace(/_/g, " ")}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{formatPrice(order.total)}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/order-tracking?id=${order.id}`}
                  className="text-xs px-2.5 sm:px-3 py-1.5 border border-[#F0185A] text-[#F0185A] rounded-lg hover:bg-pink-50 transition-colors"
                >
                  Track
                </Link>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="text-xs px-2.5 sm:px-3 py-1.5 bg-[#F0185A] text-white rounded-lg hover:bg-[#c8124a] transition-colors flex items-center gap-1"
                >
                  Details <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
