"use client";
import Link from "next/link";
import { Package, Heart, MapPin, CreditCard, ChevronRight, Loader2 } from "lucide-react";
import { useListOrders, useGetWishlist } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600",
  confirmed: "bg-blue-50 text-blue-600",
  packing: "bg-blue-50 text-blue-600",
  shipped: "bg-orange-50 text-orange-600",
  out_for_delivery: "bg-orange-50 text-orange-600",
  delivered: "bg-green-50 text-green-600",
  cancelled: "bg-red-50 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", packing: "Packing",
  shipped: "Shipped", out_for_delivery: "Out for Delivery",
  delivered: "Delivered", cancelled: "Cancelled",
};

function formatPrice(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" });
}

function memberSince(d: string) {
  return new Date(d).toLocaleDateString("en-BD", { month: "long", year: "numeric" });
}

export default function AccountDashboardPage() {
  const { user } = useAuth();
  const { data: ordersData, isLoading: ordersLoading } = useListOrders({ page: 1, limit: 5 });
  const { data: wishlist = [] } = useGetWishlist();

  const orders = ordersData?.orders ?? [];
  const totalOrders = ordersData?.total ?? 0;
  const initial = user?.name?.charAt(0).toUpperCase() ?? "U";

  const stats = [
    { label: "Total Orders", value: String(totalOrders), icon: Package, color: "bg-blue-50 text-blue-600" },
    { label: "Wishlist", value: String(wishlist.length), icon: Heart, color: "bg-pink-50 text-pink-600" },
    { label: "Reviews", value: "—", icon: "⭐", color: "bg-amber-50 text-amber-600" },
    { label: "Rewards", value: user?.referralCode ?? "—", icon: "🎁", color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-[#F0185A] to-rose-400 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover rounded-full" />
            ) : initial}
          </div>
          <div>
            <h2 className="text-xl font-bold">Welcome back, {user?.name?.split(" ")[0] ?? "there"}! 👋</h2>
            <p className="text-pink-100 text-sm">
              {user?.createdAt ? `Member since ${memberSince(user.createdAt)}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mx-auto mb-2 text-lg`}>
              {typeof s.icon === "string" ? s.icon : <s.icon className="w-5 h-5" />}
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Recent Orders</h3>
          <Link href="/account/orders" className="text-sm text-[#F0185A] flex items-center gap-1 hover:underline">
            View All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {ordersLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 text-[#F0185A] animate-spin" />
          </div>
        )}
        {!ordersLoading && orders.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No orders yet.</div>
        )}
        <div className="divide-y divide-gray-50">
          {orders.map(order => (
            <div key={order.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-[#F0185A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">Order #{order.id}</p>
                <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{formatPrice(order.total)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-50 text-gray-500"}`}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { href: "/account/profile", icon: "👤", label: "Edit Profile", desc: "Update your info" },
          { href: "/account/addresses", icon: "📍", label: "Addresses", desc: "Manage delivery addresses" },
          { href: "/account/payment-methods", icon: "💳", label: "Payment Methods", desc: "Cards & mobile banking" },
          { href: "/order-tracking", icon: "🚚", label: "Track Order", desc: "Check delivery status" },
        ].map((item, i) => (
          <Link key={i} href={item.href} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:shadow-md hover:border-[#F0185A] transition-all group">
            <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center text-xl group-hover:bg-pink-100 transition-colors">{item.icon}</div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
