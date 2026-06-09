import { Feather, MaterialIcons } from "@expo/vector-icons";
import {
  useGetCart,
  useCreateOrder,
  useListAddresses,
  useListStores,
  useListShippingZones,
  useValidateCoupon,
  useGetCoinBalance,
  useGetProduct,
  getGetCartQueryKey,
  getGetCoinBalanceQueryKey,
  getListAddressesQueryKey,
  getListStoresQueryKey,
  getListShippingZonesQueryKey,
} from "@workspace/api-client-react";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState, useEffect } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/config";
import { trackInitiateCheckout, trackPurchase } from "@/app/lib/tracking";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/contexts/ConfigContext";
import { useAlert } from "@/contexts/AlertContext";

const PINK = "#E91E63";
const BLUE = "#1565C0";

type PaymentMethod = "cod" | "bkash" | "nagad" | "rocket" | "card";
type DeliveryMethod = "home_delivery" | "store_pickup";

const PAYMENT_OPTIONS: { key: PaymentMethod; label: string; color: string; icon: any; logoLetter: string }[] = [
  { key: "cod",    label: "Cash on Delivery", color: "#16A34A", icon: "money",          logoLetter: "৳" },
  { key: "bkash",  label: "bKash",            color: "#E91E63", icon: "phone-android",  logoLetter: "B" },
  { key: "nagad",  label: "Nagad",            color: "#F97316", icon: "phone-android",  logoLetter: "N" },
  { key: "rocket", label: "Rocket",           color: "#8B5CF6", icon: "phone-android",  logoLetter: "R" },
  { key: "card",   label: "Card / Bank",      color: "#1565C0", icon: "credit-card",    logoLetter: "💳" },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const params = useLocalSearchParams<{
    buyNow?: string; productId?: string; qty?: string;
    variantId?: string; variantIds?: string; productName?: string; price?: string; thumbnail?: string;
  }>();
  const isBuyNow = params.buyNow === "1";
  const buyNowProduct = isBuyNow ? {
    productId: parseInt(params.productId ?? "0"),
    qty: parseInt(params.qty ?? "1"),
    variantId: params.variantId ? parseInt(params.variantId) : null,
    variantIds: params.variantIds ? params.variantIds.split(",").map(Number).filter(Boolean) : undefined,
    name: params.productName ?? "",
    clientPrice: parseFloat(params.price ?? "0"),
    thumbnail: params.thumbnail ?? "",
  } : null;

  // Bug #14: Fetch real server price instead of trusting client-calculated URL param
  const { data: buyNowServerProduct } = useGetProduct(
    buyNowProduct?.productId ?? 0,
    { query: { enabled: isBuyNow && (buyNowProduct?.productId ?? 0) > 0 } } as any,
  );
  const serverEffectivePrice: number = (() => {
    if (!isBuyNow || !buyNowProduct) return 0;
    if (!buyNowServerProduct) return buyNowProduct.clientPrice;
    const basePrice = Number((buyNowServerProduct as any).price ?? 0);
    const variantId = buyNowProduct.variantId;
    if (!variantId) return basePrice;
    const allVariants: any[] = (buyNowServerProduct as any).variants ?? [];
    const matched = allVariants.find((v: any) => v.id === variantId);
    if (!matched) return basePrice;
    const mod = Number(matched.priceModifier ?? 0);
    return mod > 0 ? mod : basePrice;
  })();

  const [delivery, setDelivery] = useState<DeliveryMethod>("home_delivery");
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [payDeliveryCharge, setPayDeliveryCharge] = useState(false);
  const [useCoins, setUseCoins] = useState(false);

  const { data: cart } = useGetCart({
    query: { enabled: !!token && !isBuyNow, queryKey: getGetCartQueryKey() },
  });
  const { data: addresses } = useListAddresses({ query: { enabled: !!token, queryKey: getListAddressesQueryKey() } });
  const { data: stores } = useListStores({ query: { queryKey: getListStoresQueryKey() } });
  const { data: zonesData } = useListShippingZones({ query: { queryKey: getListShippingZonesQueryKey() } });
  const zones = Array.isArray(zonesData) ? zonesData : [];
  
  // Use public useAppConfig instead of admin-only useGetSettings
  const { config: s } = useAppConfig();
  const { showAlert } = useAlert();

  // Fetch live public config directly from the API to ensure payDeliveryChargeEnabled
  // is always current, bypassing the ConfigContext cache.
  const { data: liveConfig } = useQuery({
    queryKey: ["public-config"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/config/mobile`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const payDeliveryChargeEnabled: boolean =
    liveConfig?.payDeliveryChargeEnabled ?? s?.payDeliveryChargeEnabled ?? false;
  
  const validateCoupon = useValidateCoupon();
  const createOrder = useCreateOrder();

  const { data: coinBalance } = useGetCoinBalance({
    query: { enabled: !!token, queryKey: getGetCoinBalanceQueryKey() },
  });

  const addrList = Array.isArray(addresses) ? addresses : [];
  const storeList = Array.isArray(stores) ? stores : [];

  useEffect(() => {
    if (selectedAddress === null && addrList.length > 0) {
      const defaultAddr = (addrList as any[]).find((a: any) => a.isDefault) ?? addrList[0];
      if (defaultAddr) setSelectedAddress((defaultAddr as any).id);
    }
  }, [addrList]);
  const cartItems = cart?.items ?? [];

  const selectedAddressData = addrList.find((a: any) => a.id === selectedAddress) as any;
  const district: string | undefined = selectedAddressData?.district ?? undefined;

  const enabledPaymentOptions = PAYMENT_OPTIONS.filter(opt => {
    if (opt.key === "cod")    return s?.codEnabled !== false;
    if (opt.key === "bkash")  return s?.bkashEnabled !== false;
    if (opt.key === "nagad")  return s?.nagadEnabled !== false;
    if (opt.key === "rocket") return s?.rocketEnabled !== false;
    if (opt.key === "card")   return s?.cardEnabled !== false;
    return true;
  });

  const isMfsPayment = payment !== null && ["bkash", "nagad", "rocket"].includes(payment);
  // "Pay Delivery Charge" is only active when the feature is enabled, home delivery
  // is selected, and an MFS method is chosen.
  const payDeliveryChargeActive =
    payDeliveryCharge &&
    payDeliveryChargeEnabled &&
    delivery === "home_delivery" &&
    isMfsPayment;

  const freeThreshold: number = s?.freeDeliveryThreshold ?? 500;
  const enableFreeDelivery: boolean = s?.enableFreeDelivery !== false;

  const subtotal = isBuyNow
    ? serverEffectivePrice * (buyNowProduct?.qty ?? 1)
    : cart?.subtotal ?? 0;

  const matchedZone = zones.find(
    (z) =>
      z.name.toLowerCase() === (district ?? "").toLowerCase() ||
      (Array.isArray(z.districts) ? z.districts as string[] : []).some(
        (d) => d.toLowerCase() === (district ?? "").toLowerCase()
      )
  );
  const zoneBaseFee: number = matchedZone ? Number(matchedZone.fee) : 60;

  const shippingFee = delivery === "store_pickup"
    ? 0
    : (enableFreeDelivery && subtotal >= freeThreshold) ? 0 : zoneBaseFee;

  const coinValue: number = (coinBalance as any)?.coinValue ?? 0.10;
  const coinBalanceAmount: number = (coinBalance as any)?.balance ?? 0;
  const maxCoinsUsable = useCoins && coinBalanceAmount > 0
    ? Math.min(coinBalanceAmount, Math.floor((subtotal + shippingFee - discount) / coinValue))
    : 0;
  const coinDiscount = useCoins ? maxCoinsUsable * coinValue : 0;
  const coinsToUse = useCoins ? maxCoinsUsable : 0;
  const total = Math.max(0, subtotal + shippingFee - discount - coinDiscount);

  // Fire InitiateCheckout once when the screen mounts and the order value is known.
  // The ref prevents double-fire on StrictMode or re-renders.
  const checkoutFired = React.useRef(false);
  useEffect(() => {
    if (checkoutFired.current || subtotal <= 0) return;
    checkoutFired.current = true;
    trackInitiateCheckout({ value: subtotal, numItems: isBuyNow ? (buyNowProduct?.qty ?? 1) : cartItems.length });
  }, [subtotal]); // eslint-disable-line

  const handleValidateCoupon = () => {
    if (!couponInput.trim()) return;
    validateCoupon.mutate(
      { data: { code: couponInput.trim().toUpperCase(), orderAmount: subtotal } },
      {
        onSuccess: (res: any) => {
          if (res.valid) {
            setDiscount(res.discount);
            setCouponApplied(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showAlert({ title: "Coupon applied!", message: res.message });
          } else {
            setCouponApplied(false);
            showAlert({ title: "Invalid coupon", message: res.message });
          }
        },
      }
    );
  };

  const handlePlaceOrder = () => {
    if (!payment) {
      showAlert({ title: "Select Payment Method", message: "Please choose a payment method to continue." });
      return;
    }
    if (delivery === "home_delivery" && !selectedAddress) {
      showAlert({ title: "Select Address", message: "Please select a delivery address." });
      return;
    }
    if (delivery === "store_pickup" && !selectedStore) {
      showAlert({ title: "Select Store", message: "Please select a pickup store." });
      return;
    }

    // Create the order immediately for all payment methods.
    // MFS orders are saved with paymentStatus "unpaid" and the user is directed
    // to the payment-instruction screen to submit their Transaction ID.
    const payableAmount = payDeliveryChargeActive ? shippingFee : total;
    createOrder.mutate(
      {
        data: {
          addressId: delivery === "home_delivery" ? selectedAddress ?? undefined : undefined,
          storeId: delivery === "store_pickup" ? selectedStore ?? undefined : undefined,
          deliveryMethod: delivery,
          paymentMethod: payment,
          couponCode: couponApplied ? couponInput.trim().toUpperCase() : undefined,
          notes,
          payDeliveryCharge: payDeliveryChargeActive,
          coinsToUse: coinsToUse > 0 ? coinsToUse : undefined,
          ...(isBuyNow && buyNowProduct
            ? { buyNowItems: [{ productId: buyNowProduct.productId, quantity: buyNowProduct.qty, variantId: buyNowProduct.variantId ?? undefined, variantIds: buyNowProduct.variantIds }] }
            : {}),
        } as any,
      },
      {
        onSuccess: (order: any) => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          trackPurchase({ orderId: order.id, value: total });
          if (isMfsPayment) {
            // Navigate to payment instructions so user can submit their TrxID.
            // The order is already in the DB (unpaid); if they close the app the admin can recover it.
            router.push(
              `/order/payment-instruction?orderId=${order.id}&method=${payment}&payableAmount=${payableAmount}&payDeliveryCharge=${payDeliveryChargeActive ? "1" : "0"}&deliveryFee=${shippingFee}&productTotal=${subtotal - discount}` as any
            );
          } else {
            router.replace(`/order/${order.id}` as any);
          }
        },
        onError: () =>
          showAlert({ title: "Order Failed", message: "Failed to place order. Please try again." }),
      }
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} testID="btn-back">
          <Feather name="arrow-left" size={20} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 140 }}
      >
        {/* Order Items */}
        <SectionCard title={`Order Items (${isBuyNow ? 1 : cartItems.length})`}>
          {isBuyNow && buyNowProduct ? (
            <View style={styles.orderItem}>
              {buyNowProduct.thumbnail ? (
                <Image source={{ uri: buyNowProduct.thumbnail }} style={styles.orderItemImg} resizeMode="cover" />
              ) : (
                <View style={[styles.orderItemImg, { backgroundColor: "#EEE" }]} />
              )}
              <Text style={styles.orderItemName} numberOfLines={1}>{buyNowProduct.name}</Text>
              <Text style={styles.orderItemQty}>×{buyNowProduct.qty}</Text>
              <Text style={styles.orderItemPrice}>৳{(serverEffectivePrice * buyNowProduct.qty).toLocaleString()}</Text>
            </View>
          ) : (
            <>
              {cartItems.slice(0, 3).map((item: any) => (
                <View key={item.id} style={styles.orderItem}>
                  <Image
                    source={{ uri: item.productThumbnail }}
                    style={styles.orderItemImg}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderItemName} numberOfLines={1}>{item.productName}</Text>
                    {item.variantLabel ? (
                      <Text style={styles.orderItemVariant}>{item.variantLabel}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.orderItemQty}>×{item.quantity}</Text>
                  <Text style={styles.orderItemPrice}>৳{(item.price * item.quantity).toLocaleString()}</Text>
                </View>
              ))}
              {cartItems.length > 3 && (
                <Text style={styles.moreItems}>+{cartItems.length - 3} more items</Text>
              )}
            </>
          )}
        </SectionCard>

        {/* Delivery Method */}
        <SectionCard title="Delivery Method">
          <View style={styles.deliveryRow}>
            {[
              { key: "home_delivery" as DeliveryMethod, label: "Home Delivery", icon: "local-shipping" },
              { key: "store_pickup" as DeliveryMethod, label: "Store Pickup", icon: "storefront" },
            ].map((opt) => {
              const active = delivery === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.deliveryCard, active && styles.deliveryCardActive]}
                  onPress={() => setDelivery(opt.key)}
                  testID={`delivery-${opt.key}`}
                >
                  <MaterialIcons
                    name={opt.icon as any}
                    size={22}
                    color={active ? PINK : "#888"}
                  />
                  <Text style={[styles.deliveryLabel, active && styles.deliveryLabelActive]}>
                    {opt.label}
                  </Text>
                  {active && (
                    <View style={styles.deliveryCheck}>
                      <Feather name="check" size={11} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        {/* Address */}
        {delivery === "home_delivery" && (
          <SectionCard title="Delivery Address">
            {addrList.map((addr: any) => {
              const active = selectedAddress === addr.id;
              return (
                <Pressable
                  key={addr.id}
                  style={[styles.addrCard, active && styles.addrCardActive]}
                  onPress={() => setSelectedAddress(addr.id)}
                  testID={`addr-${addr.id}`}
                >
                  <View style={styles.addrRadio}>
                    <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                      {active && <View style={styles.radioInner} />}
                    </View>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.addrLabelRow}>
                      <Text style={styles.addrLabel}>{addr.label}</Text>
                      {addr.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addrName}>{addr.fullName} · {addr.phone}</Text>
                    <Text style={styles.addrDetails} numberOfLines={2}>
                      {addr.addressLine}, {addr.area}, {addr.district}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              style={styles.addAddrBtn}
              onPress={() => router.push("/addresses" as any)}
              testID="btn-add-address"
            >
              <Feather name="plus-circle" size={16} color={PINK} />
              <Text style={styles.addAddrBtnText}>
                {addrList.length === 0 ? "Add a delivery address" : "Add new address"}
              </Text>
            </Pressable>
          </SectionCard>
        )}

        {/* Store */}
        {delivery === "store_pickup" && (
          <SectionCard title="Select Pickup Store">
            {storeList.length === 0 ? (
              <View style={styles.emptyHint}>
                <MaterialIcons name="store" size={22} color="#CCC" />
                <Text style={styles.emptyHintText}>No stores available.</Text>
              </View>
            ) : (
              storeList.map((store: any) => {
                const active = selectedStore === store.id;
                return (
                  <Pressable
                    key={store.id}
                    style={[styles.addrCard, active && styles.addrCardActive]}
                    onPress={() => setSelectedStore(store.id)}
                    testID={`store-${store.id}`}
                  >
                    <View style={styles.addrRadio}>
                      <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                        {active && <View style={styles.radioInner} />}
                      </View>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.addrLabel}>{store.name}</Text>
                      <Text style={styles.addrDetails}>{store.address}</Text>
                      <Text style={styles.addrName}>{store.openingHours}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </SectionCard>
        )}

        {/* Payment Method */}
        <SectionCard title="Payment Method">
          <View style={styles.payGrid}>
            {enabledPaymentOptions.map((opt) => {
              const active = payment === opt.key;
              const logoUrl =
                opt.key === "bkash"  ? s?.bkashLogoUrl  :
                opt.key === "nagad"  ? s?.nagadLogoUrl  :
                opt.key === "rocket" ? s?.rocketLogoUrl :
                null;
              
              // Resolve label dynamically from backend config
              const label =
                opt.key === "bkash"  ? s?.bkashNumberLabel || opt.label :
                opt.key === "nagad"  ? s?.nagadNumberLabel || opt.label :
                opt.key === "rocket" ? s?.rocketNumberLabel || opt.label :
                opt.label;

              return (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.payCard,
                    active && { borderColor: opt.color, backgroundColor: `${opt.color}14` },
                  ]}
                  onPress={() => setPayment(opt.key)}
                  testID={`payment-${opt.key}`}
                >
                  {logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={{ width: 22, height: 22, borderRadius: 4 }} resizeMode="contain" />
                  ) : (
                    <View style={[styles.payLogoCircle, { backgroundColor: opt.color }]}>
                      <Text style={styles.payLogoText}>{opt.logoLetter}</Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.payLabel,
                      active && { color: opt.color, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {label}
                  </Text>
                  {active && (
                    <View style={[styles.payCheck, { backgroundColor: opt.color }]}>
                      <Feather name="check" size={9} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        {/* Pay Delivery Charge toggle — shown when enabled in admin AND MFS method is chosen */}
        {payDeliveryChargeEnabled && delivery === "home_delivery" && isMfsPayment && (
          <SectionCard title="Partial Payment Option">
            <Pressable
              style={[styles.payDeliveryRow, payDeliveryChargeActive && styles.payDeliveryRowActive]}
              onPress={() => setPayDeliveryCharge(v => !v)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.payDeliveryTitle, payDeliveryChargeActive && { color: PINK }]}>
                  Pay Delivery Charge Only
                </Text>
                <Text style={styles.payDeliveryDesc}>
                  Pay only ৳{shippingFee} delivery fee now via {payment === "bkash" ? "bKash" : payment === "nagad" ? "Nagad" : "Rocket"}. Product price paid on delivery.
                </Text>
              </View>
              <View style={[styles.payDeliveryCheck, payDeliveryChargeActive && { backgroundColor: PINK, borderColor: PINK }]}>
                {payDeliveryChargeActive && <Feather name="check" size={11} color="#fff" />}
              </View>
            </Pressable>
          </SectionCard>
        )}

        {/* Coupon */}
        <SectionCard title="Coupon Code">
          <View style={styles.couponRow}>
            <View style={[styles.couponInput, couponApplied && styles.couponInputSuccess]}>
              <MaterialIcons
                name="local-offer"
                size={16}
                color={couponApplied ? "#16A34A" : "#AAA"}
              />
              <TextInput
                style={styles.couponText}
                placeholder="Enter coupon code"
                placeholderTextColor="#BBB"
                value={couponInput}
                onChangeText={(t) => {
                  setCouponInput(t.toUpperCase());
                  setCouponApplied(false);
                  setDiscount(0);
                }}
                autoCapitalize="characters"
                editable={!couponApplied}
                testID="input-coupon"
              />
              {couponApplied && (
                <Feather name="check-circle" size={16} color="#16A34A" />
              )}
            </View>
            <Pressable
              style={[
                styles.applyBtn,
                couponApplied && { backgroundColor: "#16A34A" },
              ]}
              onPress={couponApplied ? () => { setCouponInput(""); setCouponApplied(false); setDiscount(0); } : handleValidateCoupon}
              testID="btn-apply-coupon"
            >
              <Text style={styles.applyBtnText}>{couponApplied ? "Remove" : "Apply"}</Text>
            </Pressable>
          </View>
          {discount > 0 && (
            <Text style={styles.couponSaving}>
              You save ৳{discount.toLocaleString()} with this coupon
            </Text>
          )}
        </SectionCard>

        {/* Coin Redemption */}
        {!!token && coinBalanceAmount > 0 && (
          <SectionCard title="Redeem Coins">
            <Pressable
              style={[styles.coinRow, useCoins && styles.coinRowActive]}
              onPress={() => { setUseCoins(v => !v); Haptics.selectionAsync(); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.coinTitle, useCoins && { color: "#F59E0B" }]}>
                  Use {coinBalanceAmount} Coins
                </Text>
                <Text style={styles.coinDesc}>
                  {useCoins && maxCoinsUsable > 0
                    ? `Saving ৳${(maxCoinsUsable * coinValue).toLocaleString()} on this order`
                    : `Worth ৳${(coinBalanceAmount * coinValue).toLocaleString()} — tap to redeem`}
                </Text>
              </View>
              <View style={[styles.coinToggle, useCoins && styles.coinToggleActive]}>
                {useCoins && <Feather name="check" size={11} color="#fff" />}
              </View>
            </Pressable>
          </SectionCard>
        )}

        {/* Notes */}
        <SectionCard title="Order Notes (Optional)">
          <TextInput
            style={styles.notesInput}
            placeholder="Any special instructions for delivery..."
            placeholderTextColor="#BBB"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            testID="input-notes"
          />
        </SectionCard>

        {/* Price Details */}
        <SectionCard title="Price Details">
          <View style={styles.priceRows}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>
                Price ({isBuyNow ? (buyNowProduct?.qty ?? 1) + " item" + ((buyNowProduct?.qty ?? 1) !== 1 ? "s" : "") : cartItems.length + " item" + (cartItems.length !== 1 ? "s" : "")})
              </Text>
              <Text style={styles.priceValue}>৳{subtotal.toLocaleString()}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery Fee</Text>
              <Text style={[styles.priceValue, shippingFee === 0 && { color: "#16A34A" }]}>
                {shippingFee === 0 ? "FREE" : `৳${shippingFee}`}
              </Text>
            </View>
            {discount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: "#16A34A" }]}>Coupon Discount</Text>
                <Text style={[styles.priceValue, { color: "#16A34A" }]}>-৳{discount.toLocaleString()}</Text>
              </View>
            )}
            {coinDiscount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: "#F59E0B" }]}>Coins ({coinsToUse})</Text>
                <Text style={[styles.priceValue, { color: "#F59E0B" }]}>-৳{coinDiscount.toLocaleString()}</Text>
              </View>
            )}
            {payDeliveryChargeActive ? (
              <>
                <View style={[styles.priceRow, { backgroundColor: "#FFF3E0", borderRadius: 8, padding: 8, marginTop: 4 }]}>
                  <Text style={[styles.priceTotalLabel, { color: "#E65100", fontSize: 14 }]}>Payable Now (Delivery)</Text>
                  <Text style={[styles.priceTotalValue, { color: "#E65100" }]}>৳{shippingFee.toLocaleString()}</Text>
                </View>
                <View style={[styles.priceRow, { backgroundColor: "#F3F4F6", borderRadius: 8, padding: 8, marginTop: 4 }]}>
                  <Text style={[styles.priceLabel, { fontFamily: "Inter_600SemiBold" }]}>Due on Delivery (COD)</Text>
                  <Text style={styles.priceValue}>৳{(subtotal - discount).toLocaleString()}</Text>
                </View>
              </>
            ) : (
              <View style={[styles.priceRow, styles.priceTotalRow]}>
                <Text style={styles.priceTotalLabel}>Total Amount</Text>
                <Text style={styles.priceTotalValue}>৳{total.toLocaleString()}</Text>
              </View>
            )}
          </View>
        </SectionCard>
      </ScrollView>

      {/* Place Order Bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 },
        ]}
      >
        <View style={styles.bottomSummary}>
          <Text style={styles.bottomTotal}>
            {payDeliveryChargeActive ? `৳${shippingFee.toLocaleString()} now` : `৳${total.toLocaleString()}`}
          </Text>
          <Text style={styles.bottomItems}>
            {payDeliveryChargeActive ? "Delivery only · rest COD" : `${isBuyNow ? (buyNowProduct?.qty ?? 1) : cartItems.length} items`}
          </Text>
        </View>
        <Pressable
          style={[styles.placeOrderBtn, createOrder.isPending && { opacity: 0.7 }]}
          onPress={handlePlaceOrder}
          disabled={createOrder.isPending}
          testID="btn-place-order"
        >
          <Text style={styles.placeOrderText}>
            {createOrder.isPending ? "Placing Order…" : "Place Order"}
          </Text>
          <Feather name="check" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1A1A1A" },

  /* Section card */
  sectionCard: { backgroundColor: "#fff", padding: 16, gap: 12 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1A1A1A" },

  /* Order items */
  orderItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  orderItemImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: "#F5F5F5" },
  orderItemName: { flex: 1, fontSize: 13, color: "#333", fontFamily: "Inter_400Regular" },
  orderItemVariant: { fontSize: 11, color: "#E91E63", fontFamily: "Inter_500Medium", marginTop: 1 },
  orderItemQty: { fontSize: 12, color: "#888" },
  orderItemPrice: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1A1A1A", minWidth: 60, textAlign: "right" },
  moreItems: { fontSize: 12, color: "#888", textAlign: "center", paddingTop: 4 },
  payDeliveryRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, padding: 12 },
  payDeliveryRowActive: { borderColor: "#E91E63", backgroundColor: "#FFF0F4" },
  payDeliveryTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1A1A1A", marginBottom: 2 },
  payDeliveryDesc: { fontSize: 12, color: "#6B7280", fontFamily: "Inter_400Regular", lineHeight: 18 },
  payDeliveryCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center" },

  /* Delivery */
  deliveryRow: { flexDirection: "row", gap: 10 },
  deliveryCard: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#DDD",
    backgroundColor: "#FAFAFA",
    position: "relative",
  },
  deliveryCardActive: { borderColor: PINK, backgroundColor: "#FFF0F5" },
  deliveryLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#555", textAlign: "center" },
  deliveryLabelActive: { color: PINK, fontFamily: "Inter_700Bold" },
  deliveryCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Address / Store */
  addrCard: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFAFA",
  },
  addrCardActive: { borderColor: PINK, backgroundColor: "#FFF0F5" },
  addrRadio: { paddingTop: 2 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CCC",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: { borderColor: PINK },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: PINK },
  addrLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addrLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1A1A1A" },
  defaultBadge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: { fontSize: 10, color: BLUE, fontFamily: "Inter_600SemiBold" },
  addrName: { fontSize: 12, color: "#666" },
  addrDetails: { fontSize: 12, color: "#888", lineHeight: 17 },

  emptyHint: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  emptyHintText: { fontSize: 13, color: "#AAA" },

  /* Payment */
  payGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  payCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFAFA",
    position: "relative",
  },
  payLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#555" },
  payLogoCircle: { width: 22, height: 22, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  payLogoText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  payCheck: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Coupon */
  couponRow: { flexDirection: "row", gap: 8 },
  couponInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#DDD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FAFAFA",
  },
  couponInputSuccess: { borderColor: "#16A34A", backgroundColor: "#F0FDF4" },
  couponText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#1A1A1A", letterSpacing: 1.5 },
  applyBtn: {
    backgroundColor: PINK,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  couponSaving: { fontSize: 13, color: "#16A34A", fontFamily: "Inter_600SemiBold" },

  /* Notes */
  notesInput: {
    borderWidth: 1.5,
    borderColor: "#DDD",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#333",
    minHeight: 76,
    textAlignVertical: "top",
    backgroundColor: "#FAFAFA",
  },

  /* Price */
  priceRows: { gap: 8 },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel: { fontSize: 13, color: "#666" },
  priceValue: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#333" },
  priceTotalRow: { paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F0F0F0", marginTop: 4 },
  priceTotalLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  priceTotalValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: PINK },

  /* Bottom bar */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    elevation: 10,
  },
  bottomSummary: { gap: 2 },
  bottomTotal: { fontSize: 20, fontFamily: "Inter_700Bold", color: PINK },
  bottomItems: { fontSize: 11, color: "#888" },
  placeOrderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PINK,
    paddingVertical: 15,
    borderRadius: 12,
  },
  placeOrderText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  /* Add address button */
  addAddrBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PINK,
    borderStyle: "dashed",
    justifyContent: "center",
  },
  addAddrBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: PINK },

  /* Coin redemption */
  coinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
  },
  coinRowActive: { borderColor: "#F59E0B", backgroundColor: "#FFFBEB" },
  coinTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1A1A1A", marginBottom: 2 },
  coinDesc: { fontSize: 12, color: "#6B7280", fontFamily: "Inter_400Regular", lineHeight: 18 },
  coinToggle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  coinToggleActive: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
});