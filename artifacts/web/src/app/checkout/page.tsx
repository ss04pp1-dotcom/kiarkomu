"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Loader2, Store as StoreIcon, Coins, CheckCircle, Copy, Check, AlertCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import {
  useListAddresses, useCreateAddress, useCreateOrder,
  useValidateCoupon,
  useListStores, useListShippingZones,
  useGetCoinBalance,
  useGetProduct,
  getGetCoinBalanceQueryKey,
} from "@workspace/api-client-react";
import type { Address, CreateAddressBody, Store, ShippingZone } from "@workspace/api-client-react";
import type { CartItem } from "@/context/CartContext";
import { usePublicConfig } from "@/lib/usePublicConfig";
import { customFetch } from "@workspace/api-client-react";
import { API_BASE_URL } from "@/lib/config";
import { useQueryClient } from "@tanstack/react-query";

function formatPrice(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

const MFS_METHODS = ["bkash", "nagad", "rocket"];

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { items, clearCart } = useCart();
  const { isAuthenticated } = useAuth();

  const [step, setStep] = useState(1);
  const [deliveryMethod, setDeliveryMethod] = useState<"home_delivery" | "store_pickup">("home_delivery");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddrForm, setNewAddrForm] = useState<CreateAddressBody>({
    label: "Home", fullName: "", phone: "", addressLine: "", district: "", area: "", isDefault: false,
  });
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponValid, setCouponValid] = useState(false);
  const [useCoins, setUseCoins] = useState(false);
  const [notes, setNotes] = useState("");
  const [payDeliveryCharge, setPayDeliveryCharge] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null);
  const [mfsTxnId, setMfsTxnId] = useState("");
  const [mfsSender, setMfsSender] = useState("");
  const [mfsSubmitting, setMfsSubmitting] = useState(false);
  const [mfsError, setMfsError] = useState("");
  const [mfsCopied, setMfsCopied] = useState(false);
  const [isBuyNowMode, setIsBuyNowMode] = useState(false);
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null);
  const [step1Error, setStep1Error] = useState("");
  const [checkoutInitDone, setCheckoutInitDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "buynow") {
      setIsBuyNowMode(true);
      try {
        const stored = sessionStorage.getItem("shohure_buynow");
        if (stored) {
          const parsed = JSON.parse(stored);
          setBuyNowItem({
            id: `buynow-${parsed.productId}`,
            numericId: parsed.productId,
            name: parsed.name,
            price: parsed.price,
            image: parsed.image,
            quantity: parsed.quantity,
            variantId: parsed.variantId,
            variantIds: parsed.variantIds,
            brand: "",
            originalPrice: parsed.price,
            inStock: true,
          });
        }
      } catch {}
    }
    const couponParam = params.get("coupon");
    const discountParam = parseFloat(params.get("couponDiscount") ?? "0");
    if (couponParam && discountParam > 0) {
      setCouponCode(couponParam);
      setCouponDiscount(discountParam);
      setCouponValid(true);
    }
    setCheckoutInitDone(true);
  }, []);

  useEffect(() => {
    if (!checkoutInitDone) return;
    import("@/lib/tracking").then(({ trackInitiateCheckout }) => {
      // Bug fix #4: (window as any).__buyNowMode was never set anywhere in the codebase
      // and was always undefined (falsy). Now uses the React state isBuyNowMode that is
      // correctly set from URL params, and buyNowItem for the actual buy-now line item.
      const checkoutItemsNow: CartItem[] = isBuyNowMode && buyNowItem ? [buyNowItem] : items;
      const subtotalNow = checkoutItemsNow.reduce((s, i) => s + i.price * i.quantity, 0);
      if (subtotalNow > 0) {
        trackInitiateCheckout({ value: subtotalNow, numItems: checkoutItemsNow.length });
      }
    });
  }, [checkoutInitDone]);

  const { data: addresses = [] } = useListAddresses();
  const { data: rawStores } = useListStores();
  const { data: rawShippingZones } = useListShippingZones();
  const stores: Store[] = Array.isArray(rawStores) ? rawStores : [];
  const shippingZones: ShippingZone[] = Array.isArray(rawShippingZones) ? rawShippingZones : [];
  const { data: coinBalance } = useGetCoinBalance({
    query: { queryKey: getGetCoinBalanceQueryKey(), enabled: isAuthenticated },
  });
  const { data: appSettings } = usePublicConfig();

  const createAddressMutation = useCreateAddress();
  const createOrderMutation = useCreateOrder();
  const validateCouponMutation = useValidateCoupon();

  // New Bug B fix: fetch real server price for web Buy Now (same as Bug #14 fix on mobile)
  const { data: buyNowServerProduct } = useGetProduct(
    buyNowItem?.numericId ?? 0,
    { query: { enabled: isBuyNowMode && (buyNowItem?.numericId ?? 0) > 0 } } as any,
  );
  const serverBuyNowPrice: number = (() => {
    if (!isBuyNowMode || !buyNowItem) return 0;
    if (!buyNowServerProduct) return buyNowItem.price;
    const basePrice = Number((buyNowServerProduct as any).price ?? 0);
    const vid = buyNowItem.variantId;
    if (!vid) return basePrice;
    const allVariants: any[] = (buyNowServerProduct as any).variants ?? [];
    const matched = allVariants.find((v: any) => v.id === vid);
    if (!matched) return basePrice;
    const mod = Number(matched.priceModifier ?? 0);
    return mod > 0 ? mod : basePrice;
  })();

  const checkoutItems: CartItem[] = isBuyNowMode && buyNowItem
    ? [{ ...buyNowItem, price: serverBuyNowPrice, originalPrice: serverBuyNowPrice }]
    : items;
  const checkoutSubtotal = checkoutItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const safeAddresses: Address[] = Array.isArray(addresses) ? addresses : [];
  const defaultAddress = safeAddresses.find(a => a.isDefault) ?? safeAddresses[0];
  const activeAddress = selectedAddressId
    ? safeAddresses.find(a => a.id === selectedAddressId)
    : defaultAddress;

  const addressDistrict = (deliveryMethod === "home_delivery"
    ? (showNewAddress ? newAddrForm.district : activeAddress?.district)
    : ""
  ) ?? "";

  const shippingZone = deliveryMethod === "store_pickup"
    ? null
    : shippingZones.find(z =>
        z.name.toLowerCase() === addressDistrict.toLowerCase() ||
        (Array.isArray(z.districts) && z.districts.some(d => d.toLowerCase() === addressDistrict.toLowerCase()))
      );
  const freeThreshold = appSettings?.freeDeliveryThreshold ?? 500;
  const enableFreeDelivery = appSettings?.enableFreeDelivery !== false;
  const baseShipping = deliveryMethod === "store_pickup" ? 0 : (shippingZone?.fee ?? 60);
  const shipping = deliveryMethod === "store_pickup" ? 0 : (enableFreeDelivery && checkoutSubtotal >= freeThreshold ? 0 : baseShipping);

  const isMfsMethod = MFS_METHODS.includes(paymentMethod);
  const payDeliveryChargeEnabled = appSettings?.payDeliveryChargeEnabled ?? false;
  const payDeliveryChargeActive =
    payDeliveryCharge &&
    payDeliveryChargeEnabled &&
    deliveryMethod === "home_delivery" &&
    isMfsMethod;

  const maxCoinsUsable = coinBalance
    ? Math.min(coinBalance.balance, Math.floor((checkoutSubtotal + shipping - couponDiscount) / (coinBalance.coinValue || 1)))
    : 0;
  const coinDiscount = useCoins && coinBalance ? maxCoinsUsable * coinBalance.coinValue : 0;
  const coinsToUse = useCoins ? maxCoinsUsable : 0;
  const total = Math.max(0, checkoutSubtotal + shipping - couponDiscount - coinDiscount);
  const payableNow = payDeliveryChargeActive ? shipping : total;

  const getMfsNumber = () => {
    if (paymentMethod === "bkash") return appSettings?.bkashNumber ?? "";
    if (paymentMethod === "nagad") return appSettings?.nagadNumber ?? "";
    if (paymentMethod === "rocket") return appSettings?.rocketNumber ?? "";
    return "";
  };
  const getMfsNumberLabel = () => {
    if (paymentMethod === "bkash") return appSettings?.bkashNumberLabel ?? "bKash Number";
    if (paymentMethod === "nagad") return appSettings?.nagadNumberLabel ?? "Nagad Number";
    if (paymentMethod === "rocket") return appSettings?.rocketNumberLabel ?? "Rocket Number";
    return "Account Number";
  };
  const getMfsTxnLabel = () => {
    if (paymentMethod === "bkash") return appSettings?.bkashTxnLabel ?? "bKash Transaction ID";
    if (paymentMethod === "nagad") return appSettings?.nagadTxnLabel ?? "Nagad Transaction ID";
    if (paymentMethod === "rocket") return appSettings?.rocketTxnLabel ?? "Rocket Transaction ID";
    return "Transaction ID";
  };

  const PAYMENT_METHODS = [
    ...(appSettings?.bkashEnabled !== false ? [{ id: "bkash", label: "bKash", icon: "📱", desc: "Pay with bKash mobile banking" }] : []),
    ...(appSettings?.nagadEnabled !== false ? [{ id: "nagad", label: "Nagad", icon: "💳", desc: "Pay with Nagad mobile banking" }] : []),
    ...(appSettings?.rocketEnabled !== false ? [{ id: "rocket", label: "Rocket", icon: "🚀", desc: "Pay with Rocket mobile banking" }] : []),
    ...(appSettings?.cardEnabled !== false ? [{ id: "card", label: "Credit / Debit Card", icon: "💰", desc: "Visa, MasterCard, American Express" }] : []),
    ...(appSettings?.codEnabled !== false ? [{ id: "cod", label: "Cash on Delivery", icon: "🚚", desc: "Pay when your order arrives" }] : []),
  ].filter(Boolean);
  const displayMethods = PAYMENT_METHODS.length > 0 ? PAYMENT_METHODS : [
    { id: "bkash", label: "bKash", icon: "📱", desc: "Pay with bKash" },
    { id: "nagad", label: "Nagad", icon: "💳", desc: "Pay with Nagad" },
    { id: "cod", label: "Cash on Delivery", icon: "🚚", desc: "Pay on arrival" },
    { id: "card", label: "Card", icon: "💰", desc: "Credit/Debit card" },
  ];

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError("");
    try {
      const res = await validateCouponMutation.mutateAsync({ data: { code: couponCode.trim().toUpperCase(), orderAmount: checkoutSubtotal } });
      setCouponDiscount(res.discount ?? 0);
      setCouponValid(true);
    } catch (err: unknown) {
      setCouponError((err as { data?: { error?: string } })?.data?.error ?? "Invalid coupon code.");
      setCouponDiscount(0);
      setCouponValid(false);
    }
  };

  const handleContinueToPayment = () => {
    if (deliveryMethod === "home_delivery") {
      if (!activeAddress && !showNewAddress) {
        setStep1Error("Please select or add a delivery address to continue.");
        return;
      }
      if (showNewAddress) {
        if (!newAddrForm.fullName.trim() || !newAddrForm.phone.trim() ||
            !newAddrForm.addressLine.trim() || !newAddrForm.district.trim() || !newAddrForm.area.trim()) {
          setStep1Error("Please fill in all required address fields (Name, Phone, Address, Area, District).");
          return;
        }
      }
    } else if (deliveryMethod === "store_pickup") {
      if (!selectedStoreId) {
        setStep1Error("Please select a pickup store.");
        return;
      }
    }
    setStep1Error("");
    setStep(2);
  };

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) { router.push("/login?returnTo=/checkout"); return; }
    setPlacing(true);
    setPlaceError("");
    try {
      let addressId: number | undefined;
      let storeId: number | undefined;

      if (deliveryMethod === "home_delivery") {
        addressId = activeAddress?.id;
        if (!addressId && showNewAddress) {
          const created = await createAddressMutation.mutateAsync({ data: newAddrForm });
          addressId = created.id;
          queryClient.invalidateQueries({ queryKey: ["listAddresses"] });
        }
      } else {
        storeId = selectedStoreId ?? undefined;
      }

      const buyNowItems = checkoutItems.map(item => ({
        productId: item.numericId ?? parseInt(item.id, 10),
        quantity: item.quantity,
        variantId: item.variantId,
        variantIds: item.variantIds,
      }));

      const order = await createOrderMutation.mutateAsync({
        data: {
          deliveryMethod,
          paymentMethod: paymentMethod as "bkash" | "nagad" | "rocket" | "card" | "cod",
          addressId,
          storeId,
          couponCode: couponValid ? couponCode.trim().toUpperCase() : undefined,
          coinsToUse: coinsToUse > 0 ? coinsToUse : undefined,
          notes: notes.trim() || undefined,
          payDeliveryCharge: payDeliveryChargeActive,
          buyNowItems,
        } as any,
      });

      if (!isBuyNowMode) clearCart();
      queryClient.invalidateQueries({ queryKey: getGetCoinBalanceQueryKey() });

      if (isMfsMethod) {
        setPlacedOrderId(order.id);
        setStep(4);
      } else {
        router.push(`/order-success?id=${order.id}`);
      }
    } catch (err: unknown) {
      setPlaceError((err as { data?: { error?: string } })?.data?.error ?? "Failed to place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  const handleMfsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfsTxnId.trim()) { setMfsError("Please enter the Transaction ID."); return; }
    setMfsSubmitting(true);
    setMfsError("");
    try {
      await customFetch(`${API_BASE_URL}/api/orders/${placedOrderId}/submit-payment`, {
        method: "PATCH",
        body: JSON.stringify({ transactionId: mfsTxnId.trim(), senderNumber: mfsSender.trim() || undefined }),
        headers: { "Content-Type": "application/json" },
      });
      router.push(`/order-success?id=${placedOrderId}`);
    } catch (err: unknown) {
      setMfsError((err as { data?: { error?: string } })?.data?.error ?? "Failed to submit payment info.");
    } finally {
      setMfsSubmitting(false);
    }
  };

  if (checkoutItems.length === 0 && step < 4 && !checkoutInitDone) return null;

  if (checkoutItems.length === 0 && step < 4) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Add items before checking out</p>
        <Link href="/" className="bg-[#F0185A] text-white px-8 py-3 rounded-full font-medium hover:bg-[#c8124a] transition-colors">
          Shop Now
        </Link>
      </div>
    );
  }

  const STEPS = step === 4 ? ["Delivery", "Payment", "Confirm", "Pay Now"] : ["Delivery", "Payment", "Confirm"];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/cart" className="hover:text-[#F0185A]">Cart</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800 font-medium">Checkout</span>
      </nav>

      <div className="flex gap-2 sm:gap-4 mb-8 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step > i ? "bg-[#F0185A] text-white" : step === i + 1 ? "bg-[#F0185A] text-white ring-4 ring-pink-100" : "bg-gray-100 text-gray-400"}`}>
              {step > i ? "✓" : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:block ${step === i + 1 ? "text-[#F0185A]" : step > i ? "text-gray-600" : "text-gray-400"}`}>{s}</span>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">

          {step === 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Delivery Method</h2>

              <div className="flex gap-3 mb-5">
                {[
                  { value: "home_delivery", label: "Home Delivery", icon: "🏠" },
                  { value: "store_pickup", label: "Store Pickup", icon: "🏪" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDeliveryMethod(opt.value as "home_delivery" | "store_pickup")}
                    className={`flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-medium transition-all ${deliveryMethod === opt.value ? "border-[#F0185A] bg-pink-50 text-[#F0185A]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                  >
                    <span>{opt.icon}</span> {opt.label}
                  </button>
                ))}
              </div>

              {deliveryMethod === "home_delivery" && (
                <>
                  {isAuthenticated && safeAddresses.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {safeAddresses.map(addr => (
                        <label key={addr.id} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${(activeAddress?.id === addr.id && !showNewAddress) ? "border-[#F0185A] bg-pink-50" : "border-gray-100 hover:border-gray-200"}`}>
                          <input type="radio" name="address" checked={activeAddress?.id === addr.id && !showNewAddress} onChange={() => { setSelectedAddressId(addr.id); setShowNewAddress(false); }} className="accent-[#F0185A] mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{addr.label} — {addr.fullName}</p>
                            <p className="text-xs text-gray-500">{addr.phone}</p>
                            <p className="text-xs text-gray-500">{addr.addressLine}, {addr.area}, {addr.district}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  <div onClick={() => setShowNewAddress(v => !v)} className="mb-4 p-3 border border-dashed border-gray-200 rounded-xl flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:border-[#F0185A] hover:text-[#F0185A] transition-colors">
                    <Plus className="w-4 h-4" /> {showNewAddress ? "Cancel new address" : "Add a new address"}
                  </div>
                  {showNewAddress && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {[
                        { label: "Full Name *", key: "fullName", placeholder: "John Doe", col: 1 },
                        { label: "Phone Number *", key: "phone", placeholder: "+880 1X XXXX XXXX", col: 1 },
                        { label: "Street Address *", key: "addressLine", placeholder: "House, Road, Area", col: 2 },
                        { label: "Area / Thana *", key: "area", placeholder: "Dhanmondi", col: 1 },
                        { label: "District *", key: "district", placeholder: "Dhaka", col: 1 },
                      ].map(field => (
                        <div key={field.key} className={field.col === 2 ? "sm:col-span-2" : ""}>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">{field.label}</label>
                          {field.key === "district" ? (
                            <select
                              value={newAddrForm.district}
                              onChange={e => setNewAddrForm(prev => ({ ...prev, district: e.target.value } as CreateAddressBody))}
                              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors bg-white"
                            >
                              <option value="">Select District</option>
                              {shippingZones.map(z => (
                                <option key={z.id} value={z.name}>{z.name}</option>
                              ))}
                            </select>
                          ) : (
                            <input type="text" placeholder={field.placeholder} value={(newAddrForm as unknown as Record<string, string>)[field.key] ?? ""} onChange={e => { const v = e.target.value; setNewAddrForm(prev => ({ ...prev, [field.key]: v } as CreateAddressBody)); }} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {addressDistrict && shippingZone && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                      📦 Estimated delivery: {shippingZone.estimatedDays} days — Shipping fee: {shippingZone.fee === 0 ? "FREE" : formatPrice(shippingZone.fee)}
                    </div>
                  )}
                </>
              )}

              {deliveryMethod === "store_pickup" && (
                <>
                  {stores.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No stores available for pickup.</p>
                  ) : (
                    <div className="space-y-3">
                      {stores.map(store => (
                        <label key={store.id} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedStoreId === store.id ? "border-[#F0185A] bg-pink-50" : "border-gray-100 hover:border-gray-200"}`}>
                          <input type="radio" name="store" checked={selectedStoreId === store.id} onChange={() => setSelectedStoreId(store.id)} className="accent-[#F0185A] mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2">
                              <StoreIcon className="w-4 h-4 text-[#F0185A]" />
                              <p className="text-sm font-semibold text-gray-800">{store.name}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{store.address}</p>
                            <p className="text-xs text-gray-400">{store.openingHours}</p>
                            {store.phone && <p className="text-xs text-gray-400">{store.phone}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700">
                    ✓ No shipping fee for store pickup
                  </div>
                </>
              )}

              {step1Error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {step1Error}
                </div>
              )}
              <button onClick={handleContinueToPayment} className="mt-4 w-full py-3 bg-[#F0185A] hover:bg-[#c8124a] text-white font-semibold rounded-xl transition-colors">
                Continue to Payment
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Payment Method</h2>
              <div className="space-y-3">
                {displayMethods.map(method => (
                  <label key={method.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === method.id ? "border-[#F0185A] bg-pink-50" : "border-gray-100 hover:border-gray-200"}`}>
                    <input type="radio" name="payment" checked={paymentMethod === method.id} onChange={() => { setPaymentMethod(method.id); setPayDeliveryCharge(false); }} className="accent-[#F0185A]" />
                    <span className="text-2xl">{method.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{method.label}</p>
                      <p className="text-xs text-gray-400">{method.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {payDeliveryChargeEnabled && isMfsMethod && deliveryMethod === "home_delivery" && (
                <div className="mt-4">
                  <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${payDeliveryChargeActive ? "border-orange-400 bg-orange-50" : "border-gray-100 hover:border-gray-200"}`}>
                    <input type="checkbox" checked={payDeliveryCharge} onChange={e => setPayDeliveryCharge(e.target.checked)} className="accent-orange-500 w-4 h-4" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Pay Delivery Charge Only</p>
                      <p className="text-xs text-gray-500">Pay {formatPrice(shipping)} delivery fee now. Product cost paid on delivery.</p>
                    </div>
                  </label>
                </div>
              )}

              {coinBalance && coinBalance.balance > 0 && (
                <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Use Coins</p>
                        <p className="text-xs text-amber-600">{coinBalance.balance} coins = {formatPrice(coinBalance.balance * coinBalance.coinValue)} discount</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setUseCoins(v => !v)}
                      className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${useCoins ? "bg-amber-500" : "bg-gray-200"}`}
                      aria-label="Toggle coin redemption"
                    >
                      <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${useCoins ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  {useCoins && <p className="text-xs text-amber-700 mt-2">✓ Applying {maxCoinsUsable} coins — saving {formatPrice(coinDiscount)}</p>}
                </div>
              )}

              <div className="mt-5">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Coupon Code</label>
                <div className="flex gap-2">
                  <input type="text" value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponValid(false); setCouponError(""); setCouponDiscount(0); }} placeholder="Enter coupon code" className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors" />
                  <button onClick={handleValidateCoupon} disabled={validateCouponMutation.isPending || !couponCode.trim()} className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                    {validateCouponMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                  </button>
                </div>
                {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
                {couponValid && <p className="text-xs text-green-600 mt-1">✓ Coupon applied! Saved {formatPrice(couponDiscount)}</p>}
              </div>

              <div className="mt-5">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Order Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any special instructions for delivery..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors resize-none"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:border-gray-300 transition-colors">Back</button>
                <button onClick={() => setStep(3)} className="flex-1 py-3 bg-[#F0185A] hover:bg-[#c8124a] text-white font-semibold rounded-xl transition-colors">Review Order</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Review & Confirm</h2>

              <div className="mb-5 p-4 bg-gray-50 rounded-xl text-sm space-y-1">
                <p className="font-semibold text-gray-800 mb-2">
                  {deliveryMethod === "store_pickup" ? "Store Pickup:" : "Delivery to:"}
                </p>
                {deliveryMethod === "store_pickup" ? (
                  <>
                    <p className="text-gray-600">{stores.find(s => s.id === selectedStoreId)?.name ?? "Selected store"}</p>
                    <p className="text-gray-500 text-xs">{stores.find(s => s.id === selectedStoreId)?.address ?? ""}</p>
                  </>
                ) : activeAddress ? (
                  <>
                    <p className="text-gray-600">{activeAddress.fullName} · {activeAddress.phone}</p>
                    <p className="text-gray-600">{activeAddress.addressLine}, {activeAddress.area}, {activeAddress.district}</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600">{newAddrForm.fullName} · {newAddrForm.phone}</p>
                    <p className="text-gray-600">{newAddrForm.addressLine}, {newAddrForm.area}, {newAddrForm.district}</p>
                  </>
                )}
                <p className="text-gray-500 text-xs mt-2">Payment: <span className="font-medium capitalize">{displayMethods.find(m => m.id === paymentMethod)?.label ?? paymentMethod}</span></p>
                {payDeliveryChargeActive && (
                  <p className="text-orange-600 text-xs">Pay delivery only: {formatPrice(shipping)} now · rest on delivery</p>
                )}
                {useCoins && coinsToUse > 0 && <p className="text-amber-600 text-xs">Coins: {coinsToUse} coins (-{formatPrice(coinDiscount)})</p>}
                {notes.trim() && <p className="text-gray-500 text-xs mt-1">Notes: {notes}</p>}
              </div>

              {placeError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {placeError}
                </div>
              )}

              {isMfsMethod && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                  ℹ️ After placing the order, you&apos;ll be asked to submit your payment transaction details.
                </div>
              )}

              <div className="space-y-3 mb-5">
                {checkoutItems.map(item => (
                  <div key={`${item.id}-${item.variantId ?? 0}`} className="flex gap-3 items-center p-3 bg-gray-50 rounded-xl">
                    <div className="relative w-14 h-14 bg-white rounded-lg flex-shrink-0">
                      <Image src={item.image} alt={item.name} fill sizes="56px" className="object-contain p-1" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-bold text-gray-900 text-sm flex-shrink-0">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:border-gray-300 transition-colors">Back</button>
                <button onClick={handlePlaceOrder} disabled={placing} className="flex-1 py-3 bg-[#F0185A] hover:bg-[#c8124a] disabled:bg-pink-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {placing ? <><Loader2 className="w-4 h-4 animate-spin" /> Placing Order...</> : "Place Order"}
                </button>
              </div>
            </div>
          )}

          {step === 4 && placedOrderId && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Order Placed! (#{placedOrderId})</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {payDeliveryChargeActive
                    ? `Please pay the delivery fee of ${formatPrice(shipping)} via ${paymentMethod} to confirm your order.`
                    : "Now complete your payment to confirm your order."}
                </p>
              </div>

              <div className="bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 rounded-2xl p-5 mb-5">
                <p className="text-sm font-bold text-gray-800 mb-3 capitalize">{paymentMethod} Payment Instructions</p>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">1. Open your <span className="font-semibold capitalize">{paymentMethod}</span> app</p>
                  <p className="text-gray-600">2. Send <span className="font-bold text-[#F0185A]">{formatPrice(payableNow)}</span> to:</p>
                  {payDeliveryChargeActive && (
                    <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-1.5">
                      Delivery charge only · product cost paid on delivery
                    </p>
                  )}
                  <div className="flex items-center gap-2 bg-white rounded-xl p-3 border border-pink-100">
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">{getMfsNumberLabel()}</p>
                      <p className="font-bold text-gray-900 text-lg">{getMfsNumber() || "—"}</p>
                    </div>
                    {getMfsNumber() && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(getMfsNumber()); setMfsCopied(true); setTimeout(() => setMfsCopied(false), 2000); }}
                        className="p-2 hover:bg-pink-50 rounded-lg transition-colors"
                      >
                        {mfsCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                    )}
                  </div>
                  <p className="text-gray-600">3. Enter your transaction details below</p>
                </div>
              </div>

              <form onSubmit={handleMfsSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your {paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)} Number (Sender) *</label>
                  <input type="tel" value={mfsSender} onChange={e => setMfsSender(e.target.value)} placeholder="+880 1X XXXX XXXX" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{getMfsTxnLabel()} *</label>
                  <input type="text" value={mfsTxnId} onChange={e => setMfsTxnId(e.target.value)} required placeholder="e.g. 8N2X3K9Y" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] tracking-widest transition-colors" />
                </div>
                {mfsError && <p className="text-xs text-red-500">{mfsError}</p>}
                <button type="submit" disabled={mfsSubmitting || !mfsTxnId.trim()} className="w-full py-3 bg-[#F0185A] hover:bg-[#c8124a] disabled:bg-pink-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {mfsSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Confirm Payment"}
                </button>
                <button type="button" onClick={() => router.push(`/order-success?id=${placedOrderId}`)} className="w-full py-2.5 text-gray-400 text-sm hover:text-gray-600 transition-colors">
                  Skip for now (pay later)
                </button>
              </form>
            </div>
          )}
        </div>

        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-24">
            <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {checkoutItems.map(item => (
                <div key={`${item.id}-${item.variantId ?? 0}`} className="flex gap-3 items-center">
                  <div className="relative w-12 h-12 bg-gray-50 rounded-lg flex-shrink-0">
                    <Image src={item.image} alt={item.name} fill sizes="48px" className="object-contain p-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">×{item.quantity}</p>
                  </div>
                  <p className="text-xs font-bold text-gray-800 flex-shrink-0">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatPrice(checkoutSubtotal)}</span></div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className={shipping === 0 ? "text-green-600 font-medium" : ""}>{shipping === 0 ? "FREE" : formatPrice(shipping)}</span>
              </div>
              {couponDiscount > 0 && <div className="flex justify-between text-green-600"><span>Coupon</span><span>-{formatPrice(couponDiscount)}</span></div>}
              {coinDiscount > 0 && <div className="flex justify-between text-amber-600"><span>Coins ({coinsToUse})</span><span>-{formatPrice(coinDiscount)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
                <span>Total</span><span>{formatPrice(total)}</span>
              </div>
              {payDeliveryChargeActive && (
                <>
                  <div className="flex justify-between text-orange-600 font-semibold text-sm pt-1">
                    <span>Pay now (delivery)</span><span>{formatPrice(shipping)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>Due on delivery</span><span>{formatPrice(total - shipping)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
