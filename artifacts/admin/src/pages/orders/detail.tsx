import React, { useState, useEffect, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { API_URL } from "@/lib/api-url";
import { useGetOrder, useUpdateOrderStatus } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, Truck, Calendar, Package, Users, CheckCircle2, AlertCircle, Smartphone, Download, RefreshCw, ExternalLink, Navigation, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOrderQueryKey } from "@workspace/api-client-react";

interface LocalTrackingEntry {
  id: number;
  orderId: number;
  status: string;
  lat: number | null;
  long: number | null;
  timestamp: string;
}

interface SteadfastData {
  status: number;
  delivery_status: string;
  consignment?: Record<string, unknown>;
}

interface CarrybeeData {
  transferStatus: string;
}

interface TrackingData {
  orderId: number;
  consignmentId: number | null;
  trackingCode: string | null;
  courierService: string | null;
  carrybeeConsignmentId: string | null;
  localTracking: LocalTrackingEntry[];
  steadfast: SteadfastData | null;
  carrybee: CarrybeeData | null;
}

const TOKEN_KEY = "shohure_admin_token";

const PAY_METHOD_LABEL: Record<string, string> = {
  cod:    "Cash on Delivery",
  bkash:  "bKash",
  nagad:  "Nagad",
  rocket: "Rocket",
  card:   "Card / Bank",
};

const STEADFAST_STATUS_LABEL: Record<string, string> = {
  in_review:         "In Review",
  confirmed:         "Confirmed",
  processing:        "Processing",
  shipped:           "Shipped",
  delivered:         "Delivered",
  cancelled:         "Cancelled",
  partial_delivered: "Partially Delivered",
  partial_cancelled: "Partially Cancelled",
  unknown:           "Unknown",
};

const STEADFAST_STATUS_COLOR: Record<string, string> = {
  in_review:         "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed:         "bg-blue-100 text-blue-800 border-blue-200",
  processing:        "bg-indigo-100 text-indigo-800 border-indigo-200",
  shipped:           "bg-indigo-100 text-indigo-800 border-indigo-300",
  delivered:         "bg-green-100 text-green-800 border-green-200",
  cancelled:         "bg-red-100 text-red-800 border-red-200",
  partial_delivered: "bg-orange-100 text-orange-800 border-orange-200",
  partial_cancelled: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [courierSubmitting, setCourierSubmitting] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<"steadfast" | "carrybee">("steadfast");

  const { data: order, isLoading } = useGetOrder(id, {
    query: { enabled: !!id, queryKey: getGetOrderQueryKey(id) }
  });

  const fetchTracking = useCallback(async () => {
    if (!id) return;
    setTrackingLoading(true);
    setTrackingError(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API_URL}/api/orders/${id}/tracking`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data: TrackingData = await res.json();
      setTrackingData(data);
    } catch (err: any) {
      setTrackingError(err?.message ?? "Failed to load tracking data");
    } finally {
      setTrackingLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (order) fetchTracking();
  }, [order, fetchTracking]);

  const updateStatus = useUpdateOrderStatus();

  const handleStatusChange = (newStatus: string) => {
    updateStatus.mutate(
      { id, data: { status: newStatus as any } },
      {
        onSuccess: (updatedOrder) => {
          queryClient.setQueryData(getGetOrderQueryKey(id), (old: any) =>
            old ? { ...old, status: updatedOrder.status } : old
          );
          queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(id) });
          toast({ title: "Status updated successfully" });
        },
        onError: () => {
          toast({ title: "Failed to update status", variant: "destructive" });
        }
      }
    );
  };

  const handleSubmitCourier = async (courier: "steadfast" | "carrybee") => {
    setCourierSubmitting(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API_URL}/api/orders/${id}/submit-courier`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ courier }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const updated = await res.json();
      queryClient.setQueryData(getGetOrderQueryKey(id), (old: any) => old ? { ...old, ...updated } : old);
      toast({ title: `Sent to ${courier === "steadfast" ? "Steadfast" : "Carrybee"}!`, description: courier === "steadfast" ? `Consignment ID: ${updated.consignmentId}` : `Consignment: ${updated.carrybeeConsignmentId}` });
      setTimeout(() => fetchTracking(), 1000);
    } catch (err: any) {
      toast({ title: "Courier submission failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setCourierSubmitting(false);
    }
  };

  const handleRejectPayment = async () => {
    setRejectLoading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API_URL}/api/orders/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "unpaid", clearPaymentInfo: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(id) });
      toast({ title: "Payment marked as not verified", description: "Transaction info cleared. Customer can resubmit." });
    } catch (err: any) {
      toast({ title: "Failed to reject payment", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setRejectLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    setVerifyLoading(true);
    try {
      updateStatus.mutate(
        { id, data: { paymentStatus: "paid" } as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(id) });
            toast({ title: "✓ Payment verified!", description: "Order marked as paid. Customer has been notified." });
            setVerifyLoading(false);
          },
          onError: () => {
            toast({ title: "Verification failed", variant: "destructive" });
            setVerifyLoading(false);
          }
        }
      );
    } catch {
      setVerifyLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setInvoiceLoading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        toast({ title: "Not authenticated", variant: "destructive" });
        return;
      }

      const response = await fetch(`${API_URL}/api/orders/${id}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Invoice downloaded" });
    } catch (err: any) {
      toast({
        title: "Download failed",
        description: err?.message ?? "Could not generate invoice",
        variant: "destructive",
      });
    } finally {
      setInvoiceLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-gray-500">Loading order details...</div>;
  }

  if (!order) {
    return <div className="p-12 text-center text-gray-500">Order not found</div>;
  }

  const isMfsOrder = ["bkash", "nagad", "rocket"].includes(String(order.paymentMethod).toLowerCase());
  const hasPendingMfsPayment = isMfsOrder && (order as any).transactionId && order.paymentStatus !== "paid";
  const isUnsubmittedMfs = isMfsOrder && !(order as any).transactionId && order.paymentStatus !== "paid";
  const showInvoiceButton = order.status !== "cancelled";

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-blue-100 text-blue-800 border-blue-200",
    packing: "bg-indigo-50 text-indigo-800 border-indigo-200",
    shipped: "bg-indigo-100 text-indigo-800 border-indigo-300",
    out_for_delivery: "bg-orange-100 text-orange-800 border-orange-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    returned: "bg-gray-100 text-gray-800 border-gray-200",
  };

  const paymentStatusColors: Record<string, string> = {
    unpaid: "text-red-500",
    pending: "text-amber-600",
    pending_verification: "text-amber-600",
    paid: "text-green-600",
    failed: "text-red-500",
    refunded: "text-gray-500",
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/orders" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Order #{order.id}</h2>
          <Badge className={`${statusColors[order.status] ?? "bg-gray-100 text-gray-800 border-gray-200"} capitalize border px-3 py-1 text-sm font-medium`}>
            {order.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {showInvoiceButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadInvoice}
              disabled={invoiceLoading}
              className="gap-2 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <Download size={15} />
              {invoiceLoading ? "Generating…" : "Download Invoice"}
            </Button>
          )}
          <div className="w-full sm:w-48">
            <Select
              value={order.status}
              onValueChange={handleStatusChange}
              disabled={updateStatus.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Update status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="packing">Packing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* MFS Payment Verification Banner */}
      {hasPendingMfsPayment && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-full shrink-0">
              <AlertCircle size={22} className="text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">
                {order.paymentMethod === "bkash" ? "bKash" : order.paymentMethod === "nagad" ? "Nagad" : "Rocket"} Payment Awaiting Verification
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                Customer submitted a transaction. Please verify before marking as paid.
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-sm font-mono font-medium text-amber-900 flex items-center gap-2">
                  TrxID: <span className="bg-amber-100 px-2 py-0.5 rounded">{(order as any).transactionId}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText((order as any).transactionId ?? "")}
                    title="Copy TrxID"
                    className="ml-1 p-1 rounded hover:bg-amber-200 transition-colors text-amber-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </button>
                </p>
                <p className="text-sm font-mono font-medium text-amber-900">
                  From: <span className="bg-amber-100 px-2 py-0.5 rounded">{(order as any).senderNumber}</span>
                </p>
                <p className="text-sm font-mono font-medium text-amber-900">
                  Amount: <span className="bg-amber-100 px-2 py-0.5 rounded">৳{parseFloat((order as any).amountPaid ?? "0").toLocaleString()}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              onClick={handleRejectPayment}
              disabled={rejectLoading || verifyLoading || updateStatus.isPending}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 gap-2 w-full sm:w-auto"
            >
              <XCircle size={16} />
              {rejectLoading ? "Rejecting…" : "Mark as Not Verified"}
            </Button>
            <Button
              onClick={handleVerifyPayment}
              disabled={verifyLoading || rejectLoading || updateStatus.isPending}
              className="bg-green-600 hover:bg-green-700 text-white shrink-0 gap-2 w-full sm:w-auto"
            >
              <CheckCircle2 size={16} />
              {verifyLoading ? "Verifying…" : "Verify & Mark as Paid"}
            </Button>
          </div>
        </div>
      )}

      {isUnsubmittedMfs && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
          <Smartphone size={18} className="text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700">
            This is a <strong>{order.paymentMethod === "bkash" ? "bKash" : order.paymentMethod === "nagad" ? "Nagad" : "Rocket"}</strong> order.
            Customer has not yet submitted their Transaction ID.
          </p>
        </div>
      )}

      {/* ── Send to Courier Card (manual) ── */}
      {order.deliveryMethod === "home_delivery" && !(order as any).courierService && !(order as any).consignmentId && !(order as any).carrybeeConsignmentId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-indigo-500" />
              <CardTitle className="text-base">Send to Courier</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={selectedCourier} onValueChange={(v: any) => setSelectedCourier(v)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="steadfast">Steadfast</SelectItem>
                  <SelectItem value="carrybee">Carrybee</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => handleSubmitCourier(selectedCourier)}
                disabled={courierSubmitting}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {courierSubmitting ? <><RefreshCw size={14} className="animate-spin" /> Submitting…</> : <><Truck size={14} /> Submit to Courier</>}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2">This will create a consignment with the selected courier service.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Courier status (already submitted but no consignment yet — re-submit allowed) ── */}
      {order.deliveryMethod === "home_delivery" && (order as any).courierService && !(order as any).consignmentId && !(order as any).carrybeeConsignmentId && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-600">Courier: <strong className="capitalize">{(order as any).courierService}</strong></span>
              <Select value={selectedCourier} onValueChange={(v: any) => setSelectedCourier(v)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="steadfast">Steadfast</SelectItem>
                  <SelectItem value="carrybee">Carrybee</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => handleSubmitCourier(selectedCourier)} disabled={courierSubmitting}>
                {courierSubmitting ? "Resubmitting…" : "Re-submit"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Courier Tracking Card ── */}
      {(order.deliveryMethod === "home_delivery") && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-blue-500" />
                <CardTitle className="text-base">Courier Tracking</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTracking}
                disabled={trackingLoading}
                className="h-8 gap-1.5 text-xs text-gray-500"
              >
                <RefreshCw size={13} className={trackingLoading ? "animate-spin" : ""} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {trackingLoading && !trackingData && (
              <p className="text-sm text-gray-400 text-center py-4">Loading tracking info…</p>
            )}

            {trackingError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                <AlertCircle size={15} className="shrink-0" />
                {trackingError}
              </div>
            )}

            {!trackingLoading && !trackingError && trackingData && (
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Left: consignment details + live status */}
                <div className="space-y-4">
                  {/* Steadfast tracking */}
                  {trackingData.consignmentId ? (
                    <>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Steadfast</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Consignment ID</span>
                          <span className="text-sm font-mono font-semibold text-gray-900">{trackingData.consignmentId}</span>
                        </div>
                        {trackingData.trackingCode && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tracking Code</span>
                            <span className="flex items-center gap-1.5">
                              <span className="text-sm font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                {trackingData.trackingCode}
                              </span>
                              <a
                                href={`https://steadfast.com.bd/t/${trackingData.trackingCode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Track on Steadfast"
                              >
                                <ExternalLink size={13} />
                              </a>
                            </span>
                          </div>
                        )}
                      </div>
                      {trackingData.steadfast ? (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Steadfast Live Status</p>
                          <Badge
                            className={`border px-3 py-1 text-xs font-semibold ${
                              STEADFAST_STATUS_COLOR[trackingData.steadfast.delivery_status] ?? "bg-gray-100 text-gray-700 border-gray-200"
                            }`}
                          >
                            {STEADFAST_STATUS_LABEL[trackingData.steadfast.delivery_status] ?? trackingData.steadfast.delivery_status}
                          </Badge>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Steadfast live status unavailable</p>
                      )}
                    </>
                  ) : null}

                  {/* Carrybee tracking */}
                  {trackingData.carrybeeConsignmentId ? (
                    <>
                      <div className="space-y-2 mt-3">
                        <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide">Carrybee</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Consignment ID</span>
                          <span className="text-sm font-mono font-semibold text-gray-900">{trackingData.carrybeeConsignmentId}</span>
                        </div>
                        {trackingData.carrybee ? (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Transfer Status</p>
                            <Badge className="border px-3 py-1 text-xs font-semibold bg-orange-50 text-orange-800 border-orange-200">
                              {trackingData.carrybee.transferStatus}
                            </Badge>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Carrybee status unavailable</p>
                        )}
                      </div>
                    </>
                  ) : null}

                  {!trackingData.consignmentId && !trackingData.carrybeeConsignmentId && (
                    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                      <AlertCircle size={15} className="shrink-0" />
                      No courier consignment found for this order yet.
                    </div>
                  )}
                </div>

                {/* Right: local tracking timeline */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Order Timeline</p>
                  {trackingData.localTracking.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No tracking events yet.</p>
                  ) : (
                    <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                      {trackingData.localTracking.map((entry, idx) => (
                        <li key={entry.id} className="ml-4">
                          <span
                            className={`absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${
                              idx === trackingData.localTracking.length - 1
                                ? "border-blue-500 bg-blue-500"
                                : "border-gray-300 bg-white"
                            }`}
                          />
                          <p className="text-sm font-medium text-gray-900 capitalize">
                            {entry.status.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Delivery Location Map ── */}
      {order.deliveryMethod === "home_delivery" && order.address && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation size={16} className="text-green-500" />
                <CardTitle className="text-base">Delivery Location</CardTitle>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [order.address.addressLine, order.address.area, order.address.district, "Bangladesh"]
                    .filter(Boolean)
                    .join(", ")
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <ExternalLink size={12} />
                  Open in Google Maps
                </Button>
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 pb-3 text-sm text-gray-600">
              <span className="font-medium">{order.address.fullName}</span>
              {" · "}{order.address.phone}
              {" · "}{[order.address.addressLine, order.address.area, order.address.district].filter(Boolean).join(", ")}
            </div>
            <div className="h-64 w-full border-t">
              <iframe
                title="Delivery location"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  [order.address.addressLine, order.address.area, order.address.district, "Bangladesh"]
                    .filter(Boolean)
                    .join(", ")
                )}&output=embed&z=15`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>Items purchased in this order</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {order.items.map((item) => (
                <div key={item.id} className="py-4 flex gap-4 items-center">
                  <div className="h-16 w-16 bg-gray-100 rounded-md border overflow-hidden flex-shrink-0">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Package size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{item.productName}</h4>
                    {item.variantLabel && (
                      <p className="text-sm text-gray-500">{item.variantLabel}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">৳ {(parseFloat(item.price as any) * item.quantity).toLocaleString()}</p>
                    <p className="text-sm text-gray-500">৳ {parseFloat(item.price as any).toLocaleString()} each</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>৳ {parseFloat(order.subtotal as any).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping Fee</span>
                  <span>৳ {parseFloat(order.shippingFee as any).toLocaleString()}</span>
                </div>
                {parseFloat(order.discount as any) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>- ৳ {parseFloat(order.discount as any).toLocaleString()}</span>
                  </div>
                )}
                {parseFloat(order.coinsUsed as any) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Coins Used</span>
                    <span>- ৳ {parseFloat(order.coinsUsed as any).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-lg pt-4 border-t mt-4">
                  <span>Total</span>
                  <span>৳ {parseFloat(order.total as any).toLocaleString()}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-dashed space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Paid Upfront</span>
                    <span className="font-semibold text-green-700">৳ {parseFloat((order as any).amountPaid ?? "0").toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Due on Delivery (COD)</span>
                    <span className="font-semibold text-orange-600">৳ {parseFloat((order as any).amountDue ?? "0").toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-50 p-2 rounded-full text-blue-600 shrink-0">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.userName}</p>
                  <p className="text-sm text-gray-500">User ID: {order.userId}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-blue-50 p-2 rounded-full text-blue-600 shrink-0">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Order Date</p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping & Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-50 p-2 rounded-full text-blue-600 shrink-0">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {order.deliveryMethod === 'home_delivery' ? 'Home Delivery' : 'Store Pickup'}
                  </p>
                  {order.address ? (
                    <p className="text-sm text-gray-500 mt-1">
                      {order.address.fullName}<br />
                      {order.address.phone}<br />
                      {order.address.addressLine}, {order.address.area}, {order.address.district}
                    </p>
                  ) : order.storeName ? (
                    <p className="text-sm text-gray-500 mt-1">Pickup at: {order.storeName}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-start gap-3 border-t pt-4">
                <div className="bg-blue-50 p-2 rounded-full text-blue-600 shrink-0">
                  <Truck size={16} />
                </div>
                <div className="w-full">
                  <p className="text-sm font-medium text-gray-900">{PAY_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</p>
                  <p className={`text-sm mt-1 font-medium ${paymentStatusColors[order.paymentStatus] ?? "text-gray-600"}`}>
                    Payment: {order.paymentStatus === 'paid' 
                      ? (order.payDeliveryCharge ? 'Delivery Fee Paid' : 'Paid') 
                      : (['pending', 'pending_verification'].includes(order.paymentStatus) ? 'Verifying' : 'Unpaid')}
                  </p>
                  {(order as any).transactionId && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transaction Details</p>
                      <p className="text-sm text-gray-800 font-mono">
                        TrxID: <span className="font-semibold">{(order as any).transactionId}</span>
                      </p>
                      <p className="text-sm text-gray-800 font-mono">
                        From: <span className="font-semibold">{(order as any).senderNumber}</span>
                      </p>
                      <p className="text-sm text-gray-800 font-mono">
                        Amount: <span className="font-semibold">৳{parseFloat((order as any).amountPaid ?? "0").toLocaleString()}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}