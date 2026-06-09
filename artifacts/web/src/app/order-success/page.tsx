"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Suspense, useEffect, useRef } from "react";

function formatDate(d: string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" });
}

function OrderSuccessContent() {
  const params = useSearchParams();
  const idParam = params.get("id");
  const orderId = idParam ? parseInt(idParam, 10) : null;
  const purchaseFired = useRef(false);

  const { data: order, isLoading } = useGetOrder(orderId!, {
    query: { queryKey: getGetOrderQueryKey(orderId ?? 0), enabled: !!orderId && !isNaN(orderId!) },
  });

  useEffect(() => {
    if (!order || purchaseFired.current) return;
    purchaseFired.current = true;
    import("@/lib/tracking").then(({ trackPurchase }) => {
      trackPurchase({
        orderId: order.id,
        value: parseFloat(String((order as any).total ?? (order as any).totalAmount ?? 0)),
        items: ((order as any).items ?? []).map((i: any) => ({
          id: i.productId ?? i.id,
          name: i.productName ?? i.name ?? "",
          price: parseFloat(String(i.unitPrice ?? i.price ?? 0)),
          quantity: i.quantity ?? 1,
        })),
      });
    });
  }, [order]);

  const displayId = order ? `#${String(order.id).padStart(8, "0").toUpperCase()}` : (idParam ? `#${idParam}` : "—");
  const paymentMethod = order?.paymentMethod ?? "—";
  const createdAt = order?.createdAt;
  const expectedDelivery = createdAt
    ? formatDate(new Date(new Date(createdAt).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString())
    : "—";

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="bg-white rounded-3xl border border-gray-100 p-10 shadow-sm">
        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-14 h-14 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
        <p className="text-gray-500 mb-1">Your order has been placed successfully.</p>
        <p className="text-sm text-gray-400 mb-6">
          You will receive an order confirmation shortly.
        </p>

        <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Order ID</span>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <span className="font-semibold text-gray-800">{displayId}</span>
            )}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Expected Delivery</span>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <span className="font-semibold text-gray-800">{expectedDelivery}</span>
            )}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Payment Method</span>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <span className="font-semibold text-gray-800 capitalize">{paymentMethod}</span>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href={orderId ? `/order-tracking?id=${orderId}` : "/account/orders"}
            className="flex-1 py-3 border-2 border-[#F0185A] text-[#F0185A] font-semibold rounded-xl hover:bg-pink-50 transition-colors text-center text-sm"
          >
            View Order Details
          </Link>
          <Link href="/" className="flex-1 py-3 bg-[#F0185A] hover:bg-[#c8124a] text-white font-semibold rounded-xl transition-colors text-center text-sm">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="max-w-xl mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F0185A]" />
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
