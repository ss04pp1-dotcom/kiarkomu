"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, CheckCircle, Package, Truck, Home, MapPin, Loader2, ExternalLink } from "lucide-react";
import {
  useGetOrder, useGetOrderTracking,
  getGetOrderQueryKey, getGetOrderTrackingQueryKey,
} from "@workspace/api-client-react";

function formatPrice(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

const STATUS_STEP_ORDER = ["pending", "confirmed", "packing", "shipped", "out_for_delivery", "delivered"];

const STEP_CONFIG = [
  { label: "Order Placed", statuses: ["pending"], icon: CheckCircle },
  { label: "Confirmed", statuses: ["confirmed"], icon: CheckCircle },
  { label: "Processing", statuses: ["packing"], icon: Package },
  { label: "Shipped", statuses: ["shipped"], icon: Truck },
  { label: "Out for Delivery", statuses: ["out_for_delivery"], icon: MapPin },
  { label: "Delivered", statuses: ["delivered"], icon: Home },
];

export default function OrderTrackingPage() {
  const [inputId, setInputId] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);

  const { data: order, isLoading: orderLoading, error: orderError } = useGetOrder(orderId!, {
    query: { queryKey: getGetOrderQueryKey(orderId ?? 0), enabled: !!orderId, retry: 1 },
  });
  const { data: trackingData } = useGetOrderTracking(orderId!, {
    query: { queryKey: getGetOrderTrackingQueryKey(orderId ?? 0), enabled: !!orderId },
  });
  const tracking = trackingData?.localTracking ?? [];

  const handleTrack = () => {
    const id = parseInt(inputId.replace(/\D/g, ""), 10);
    if (!isNaN(id) && id > 0) setOrderId(id);
  };

  const currentStatusIndex = order ? STATUS_STEP_ORDER.indexOf(order.status) : -1;

  const getStepDate = (statuses: string[]) => {
    const event = tracking.find(t => statuses.includes(t.status));
    return event ? formatDate(event.timestamp) : "";
  };

  const steadfastUrl = order?.trackingCode
    ? `https://steadfast.com.bd/user/tracking?invoice=${order.trackingCode}`
    : null;
  const carrybeeUrl = order?.carrybeeConsignmentId
    ? `https://carrybee.com.bd/tracking/${order.carrybeeConsignmentId}`
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800 font-medium">Track Your Order</span>
      </nav>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Track Your Order</h1>
        <div className="flex gap-3">
          <input
            type="text"
            value={inputId}
            onChange={e => setInputId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleTrack()}
            placeholder="Enter Order ID (e.g. 123)"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]"
          />
          <button
            onClick={handleTrack}
            className="px-5 py-2.5 bg-[#F0185A] hover:bg-[#c8124a] text-white font-medium rounded-xl text-sm flex items-center gap-2 transition-colors"
          >
            <Search className="w-4 h-4" /> Track
          </button>
        </div>
      </div>

      {orderLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#F0185A] animate-spin" />
        </div>
      )}

      {orderError && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
          Order not found. Please check the order ID and try again.
        </div>
      )}

      {order && !orderLoading && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <p className="text-sm text-gray-500">Order ID</p>
                <p className="font-bold text-gray-900">#{order.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Order Date</p>
                <p className="font-bold text-gray-900">{formatDate(order.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="font-bold text-[#F0185A]">{formatPrice(order.total)}</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-100 z-0" />
              {currentStatusIndex >= 0 && (
                <div
                  className="absolute top-5 left-5 h-0.5 bg-[#F0185A] z-0 transition-all"
                  style={{ width: `${(currentStatusIndex / (STEP_CONFIG.length - 1)) * 100}%` }}
                />
              )}
              <div className="flex justify-between relative z-10">
                {STEP_CONFIG.map((step, i) => {
                  const Icon = step.icon;
                  const done = currentStatusIndex >= i;
                  const date = getStepDate(step.statuses);
                  return (
                    <div key={i} className="flex flex-col items-center gap-2 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${done ? "bg-[#F0185A] border-[#F0185A]" : "bg-white border-gray-200"}`}>
                        <Icon className={`w-5 h-5 ${done ? "text-white" : "text-gray-300"}`} />
                      </div>
                      <p className="text-xs font-medium text-center text-gray-700 hidden md:block">{step.label}</p>
                      <p className="text-xs text-gray-400 text-center hidden md:block">{date}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {(steadfastUrl || carrybeeUrl || order.trackingCode) && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <h3 className="font-semibold text-blue-900 mb-3 text-sm flex items-center gap-2">
                <Truck className="w-4 h-4" /> Courier Tracking
              </h3>
              <div className="flex flex-wrap gap-2 items-center">
                {order.trackingCode && (
                  <span className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg">
                    Tracking Code: <strong>{order.trackingCode}</strong>
                    {order.courierService && ` (${order.courierService})`}
                  </span>
                )}
                {steadfastUrl && (
                  <a href={steadfastUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                    <ExternalLink className="w-3 h-3" /> Track on Steadfast
                  </a>
                )}
                {carrybeeUrl && (
                  <a href={carrybeeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                    <ExternalLink className="w-3 h-3" /> Track on Carrybee
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">Order Details</h3>
              {order.items?.slice(0, 3).map((item: (typeof order.items)[number]) => (
                <div key={item.id} className="flex gap-3 mb-3">
                  <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.productName} className="w-full h-full object-contain p-1 rounded-xl" />
                    ) : (
                      <Package className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.productName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">Delivery Address</h3>
              {order.address ? (
                <>
                  <p className="text-sm font-medium text-gray-800">{order.address.fullName}</p>
                  <p className="text-sm text-gray-500 mt-1">{order.address.phone}</p>
                  <p className="text-sm text-gray-500">{order.address.addressLine}</p>
                  <p className="text-sm text-gray-500">{order.address.area}, {order.address.district}</p>
                </>
              ) : (
                <p className="text-sm text-gray-400">🏪 In-store pickup</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <p className="text-sm text-gray-500 mb-3">Need help with your order?</p>
            <Link href="/account/messages" className="text-[#F0185A] text-sm font-medium hover:underline">
              Contact Support
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
