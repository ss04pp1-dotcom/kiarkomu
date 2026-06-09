"use client";
export const runtime = "edge";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight, Package, Truck, Home, MapPin, CheckCircle,
  Loader2, ExternalLink, Clock, ArrowLeft, CreditCard,
} from "lucide-react";
import {
  useGetOrder, useGetOrderTracking,
  getGetOrderQueryKey, getGetOrderTrackingQueryKey,
} from "@workspace/api-client-react";
import type { TrackingEvent } from "@workspace/api-client-react";

function formatPrice(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleString("en-BD", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
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
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600 border-amber-200",
  confirmed: "bg-blue-50 text-blue-600 border-blue-200",
  packing: "bg-blue-50 text-blue-600 border-blue-200",
  shipped: "bg-orange-50 text-orange-600 border-orange-200",
  out_for_delivery: "bg-orange-50 text-orange-600 border-orange-200",
  delivered: "bg-green-50 text-green-600 border-green-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  returned: "bg-gray-50 text-gray-600 border-gray-200",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", packing: "Packing",
  shipped: "Shipped", out_for_delivery: "Out for Delivery",
  delivered: "Delivered", cancelled: "Cancelled", returned: "Returned",
};
const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on Delivery", bkash: "bKash", nagad: "Nagad",
  rocket: "Rocket", card: "Card / SSLCommerz",
};
const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: "text-amber-600", pending: "text-blue-600", paid: "text-green-600",
  failed: "text-red-600", refunded: "text-gray-600",
};

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = parseInt(params.id as string, 10);

  const { data: order, isLoading, error } = useGetOrder(orderId, {
    query: { queryKey: getGetOrderQueryKey(orderId), enabled: !!orderId && !isNaN(orderId) },
  });
  const { data: trackingData } = useGetOrderTracking(orderId, {
    query: { queryKey: getGetOrderTrackingQueryKey(orderId), enabled: !!orderId && !isNaN(orderId) },
  });
  const tracking = trackingData?.localTracking ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#F0185A] animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
        <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 font-medium mb-2">Order not found</p>
        <Link href="/account/orders" className="text-sm text-[#F0185A] hover:underline">Back to Orders</Link>
      </div>
    );
  }

  const currentStatusIndex = STATUS_STEP_ORDER.indexOf(order.status);
  const isCancelled = order.status === "cancelled" || order.status === "returned";

  const getStepDate = (statuses: string[]) => {
    const event = tracking.find(t => statuses.includes(t.status));
    return event ? formatDate(event.timestamp) : "";
  };

  const hasCourierTracking = order.trackingCode && order.courierService;
  const steadfastUrl = order.trackingCode && (order.courierService === "steadfast" || !order.courierService)
    ? `https://steadfast.com.bd/user/tracking?invoice=${order.trackingCode}`
    : null;
  const carrybeeUrl = order.carrybeeConsignmentId
    ? `https://carrybee.com.bd/tracking/${order.carrybeeConsignmentId}`
    : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Order #{order.id}</h2>
          <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
        </div>
        <span className={`ml-auto text-xs px-3 py-1.5 rounded-full font-medium border ${STATUS_COLORS[order.status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      {!isCancelled && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="font-bold text-gray-900 mb-5 text-sm">Order Progress</h3>
          <div className="relative">
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100 z-0" />
            {currentStatusIndex >= 0 && (
              <div
                className="absolute top-4 left-4 h-0.5 bg-[#F0185A] z-0 transition-all duration-500"
                style={{ width: `${(currentStatusIndex / (STEP_CONFIG.length - 1)) * (100 - (8 / (STEP_CONFIG.length - 1) * 100 / 100))}%` }}
              />
            )}
            <div className="flex justify-between relative z-10 gap-0.5">
              {STEP_CONFIG.map((step, i) => {
                const Icon = step.icon;
                const completed = currentStatusIndex > i;
                const active = currentStatusIndex === i;
                const done = completed || active;
                const date = getStepDate(step.statuses);
                return (
                  <div key={i} className="flex flex-col items-center flex-1 min-w-0">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 ${done ? "bg-[#F0185A] border-[#F0185A]" : "bg-white border-gray-200"} ${active ? "ring-4 ring-pink-100" : ""}`}>
                      <Icon className={`w-3.5 h-3.5 sm:w-5 sm:h-5 ${done ? "text-white" : "text-gray-300"}`} />
                    </div>
                    <p className={`text-[9px] sm:text-[11px] font-medium text-center leading-tight mt-1.5 px-0.5 break-words w-full ${done ? "text-[#F0185A]" : "text-gray-400"}`}>
                      {step.label}
                    </p>
                    {date && <p className="text-[8px] sm:text-[10px] text-gray-400 text-center leading-tight mt-0.5 hidden sm:block">{date}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(hasCourierTracking || steadfastUrl || carrybeeUrl) && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
          <h3 className="font-semibold text-blue-900 text-sm mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4" /> Courier Tracking
          </h3>
          <div className="flex flex-wrap gap-2">
            {order.trackingCode && (
              <div className="text-xs text-blue-700 bg-white/60 px-3 py-1.5 rounded-lg">
                Tracking: <span className="font-bold">{order.trackingCode}</span>
              </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4 text-sm">Order Items</h3>
          <div className="space-y-3">
            {order.items?.map((item: (typeof order.items)[number]) => (
              <div key={item.id} className="flex gap-3 items-center">
                <div className="w-14 h-14 bg-gray-50 rounded-xl flex-shrink-0 overflow-hidden">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.productName} className="w-full h-full object-contain p-1" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-gray-300" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                  {item.variantLabel && <p className="text-xs text-gray-400">{item.variantLabel}</p>}
                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-bold text-gray-900 flex-shrink-0">{formatPrice(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F0185A]" /> Delivery Address
            </h3>
            {order.address ? (
              <div className="text-sm text-gray-600 space-y-0.5">
                <p className="font-medium text-gray-800">{order.address.fullName}</p>
                <p>{order.address.phone}</p>
                <p>{order.address.addressLine}</p>
                <p>{order.address.area}, {order.address.district}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">🏪 Store Pickup</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#F0185A]" /> Payment Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Method</span>
                <span className="font-medium">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Payment Status</span>
                <span className={`font-semibold capitalize ${PAYMENT_STATUS_COLORS[order.paymentStatus] ?? "text-gray-700"}`}>
                  {order.paymentStatus}
                </span>
              </div>
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Shipping</span><span>{formatPrice(order.shippingFee)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatPrice(order.discount)}</span></div>}
              {order.coinsUsed > 0 && <div className="flex justify-between text-amber-600"><span>Coins</span><span>-{formatPrice(order.coinsUsed)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 text-base">
                <span>Total</span><span>{formatPrice(order.total)}</span>
              </div>
              {order.amountDue > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Amount Due</span><span>{formatPrice(order.amountDue)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {tracking.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="font-bold text-gray-900 mb-4 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#F0185A]" /> Tracking History
          </h3>
          <div className="space-y-3">
            {tracking.map((event, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${i === 0 ? "bg-[#F0185A]" : "bg-gray-200"}`} />
                  {i < tracking.length - 1 && <div className="w-0.5 h-8 bg-gray-100 mt-1" />}
                </div>
                <div className="pb-1">
                  <p className="text-sm font-medium text-gray-800 capitalize">{STATUS_LABELS[event.status] ?? event.status}</p>
                  {(event as any).note && <p className="text-xs text-gray-500">{(event as any).note}</p>}
                  <p className="text-xs text-gray-400">{formatDate(event.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
        <p className="text-sm text-gray-500 mb-3">Need help with this order?</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/account/messages" className="text-xs px-4 py-2 bg-[#F0185A] text-white rounded-lg hover:bg-[#c8124a] transition-colors">
            Contact Support
          </Link>
          <Link href={`/order-tracking?id=${order.id}`} className="text-xs px-4 py-2 border border-[#F0185A] text-[#F0185A] rounded-lg hover:bg-pink-50 transition-colors">
            Track Order
          </Link>
        </div>
      </div>
    </div>
  );
}
