import { Feather, MaterialIcons } from "@expo/vector-icons";
import {
  useClearCart,
  useGetCart,
  useRemoveCartItem,
  useUpdateCartItem,
  useGetSettings,
  getGetCartQueryKey,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";

const PINK = "#E91E63";
const BLUE = "#1565C0";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { showConfirm } = useAlert();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const { data: cart, isLoading } = useGetCart({
    query: { enabled: !!token, queryKey: getGetCartQueryKey() },
  });
  const { data: appSettings } = useGetSettings();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();

  const s = appSettings as any;
  const FREE_SHIPPING_THRESHOLD: number = s?.freeDeliveryThreshold ?? 500;
  const enableFreeDelivery: boolean = s?.enableFreeDelivery === true;

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const isFreeShipping = enableFreeDelivery && subtotal >= FREE_SHIPPING_THRESHOLD;
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
  const progressPct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const handleQty = (itemId: number, newQty: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (newQty <= 0) {
      removeItem.mutate(
        { itemId },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }) }
      );
    } else {
      updateItem.mutate(
        { itemId, data: { quantity: newQty } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }) }
      );
    }
  };

  const handleRemove = (itemId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeItem.mutate(
      { itemId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }) }
    );
  };

  /* ── Not logged in ── */
  if (!token) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Feather name="shopping-cart" size={72} color="#DDD" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Login to view your saved items</Text>
          <Pressable
            style={styles.actionBtn}
            onPress={() => router.push("/auth/login" as any)}
            testID="btn-login"
          >
            <Text style={styles.actionBtnText}>Login / Register</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ── Empty cart ── */
  if (!isLoading && items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Feather name="shopping-cart" size={72} color="#DDD" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Browse and add products you love</Text>
          <Pressable
            style={styles.actionBtn}
            onPress={() => router.push("/(tabs)/" as any)}
            testID="btn-shop-now"
          >
            <Text style={styles.actionBtnText}>Start Shopping</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          My Cart{items.length > 0 ? ` (${items.length})` : ""}
        </Text>
        {items.length > 0 && (
          <Pressable
            onPress={() =>
              showConfirm(
                "Clear Cart",
                "Remove all items?",
                () => clearCart.mutate(undefined, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }) }),
                "Clear All"
              )
            }
            testID="btn-clear-cart"
          >
            <Text style={styles.clearText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {/* ── Free shipping bar ── */}
      {enableFreeDelivery && subtotal < FREE_SHIPPING_THRESHOLD && (
        <View style={styles.shippingBar}>
          <MaterialIcons name="local-shipping" size={15} color={BLUE} />
          <Text style={styles.shippingBarText}>
            Add{" "}
            <Text style={{ fontFamily: "Inter_700Bold", color: PINK }}>
              ৳{remaining.toLocaleString()}
            </Text>{" "}
            more for{" "}
            <Text style={{ fontFamily: "Inter_700Bold", color: "#16A34A" }}>
              FREE delivery
            </Text>
          </Text>
        </View>
      )}
      {enableFreeDelivery && subtotal >= FREE_SHIPPING_THRESHOLD && (
        <View style={[styles.shippingBar, { backgroundColor: "#F0FDF4" }]}>
          <MaterialIcons name="check-circle" size={15} color="#16A34A" />
          <Text style={[styles.shippingBarText, { color: "#16A34A" }]}>
            You qualify for FREE delivery!
          </Text>
        </View>
      )}
      {/* Progress bar */}
      {enableFreeDelivery && (
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 240 }}
        renderItem={({ item }: { item: any }) => (
          <View style={styles.cartCard}>
            {/* Product image */}
            <Pressable onPress={() => router.push(`/product/${item.productId}` as any)}>
              <Image
                source={{
                  uri: item.productThumbnail,
                }}
                style={styles.cardImg}
                resizeMode="cover"
              />
            </Pressable>

            {/* Info */}
            <View style={styles.cardBody}>
              <Text style={styles.cardName} numberOfLines={2}>
                {item.productName}
              </Text>
              {item.variantLabel ? (
                <View style={styles.variantTag}>
                  <Text style={styles.variantTagText}>{item.variantLabel}</Text>
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.cardPrice}>
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </Text>
                  <Text style={styles.cardUnitPrice}>
                    ৳{Number(item.price).toLocaleString()} each
                  </Text>
                </View>

                {/* Qty stepper */}
                <View style={styles.qtyRow}>
                  <Pressable
                    style={[styles.qtyBtn, item.quantity <= 1 && styles.qtyBtnDestructive]}
                    onPress={() => handleQty(item.id, item.quantity - 1)}
                    testID={`btn-qty-minus-${item.id}`}
                  >
                    <Feather
                      name={item.quantity <= 1 ? "trash-2" : "minus"}
                      size={13}
                      color={item.quantity <= 1 ? "#EF4444" : "#333"}
                    />
                  </Pressable>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => handleQty(item.id, item.quantity + 1)}
                    testID={`btn-qty-plus-${item.id}`}
                  >
                    <Feather name="plus" size={13} color="#333" />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Remove */}
            <Pressable
              style={styles.removeBtn}
              onPress={() => handleRemove(item.id)}
              testID={`btn-remove-${item.id}`}
            >
              <Feather name="x" size={16} color="#AAA" />
            </Pressable>
          </View>
        )}
      />

      {/* ── Order Summary ── */}
      <View style={[styles.summary, { paddingBottom: Math.max(12, insets.bottom) }]}>
        {/* Summary rows */}
        <View style={styles.summaryRows}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})
            </Text>
            <Text style={styles.summaryValue}>৳{subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text
              style={[
                styles.summaryValue,
                isFreeShipping && { color: "#16A34A", fontFamily: "Inter_700Bold" },
              ]}
            >
              {isFreeShipping ? "FREE" : "At checkout"}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>৳{subtotal.toLocaleString()}</Text>
          </View>
        </View>

        <Pressable
          style={styles.checkoutBtn}
          onPress={() => router.push("/checkout" as any)}
          testID="btn-checkout"
        >
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  clearText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#EF4444" },

  /* Free shipping bar */
  shippingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  shippingBarText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#444" },
  progressBg: { height: 3, backgroundColor: "#E0E0E0" },
  progressFill: { height: 3, backgroundColor: PINK, borderRadius: 2 },

  /* Empty */
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  emptySubtitle: { fontSize: 14, color: "#888", textAlign: "center" },
  actionBtn: {
    marginTop: 8,
    backgroundColor: PINK,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  actionBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },

  /* Cart card */
  cartCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    elevation: 1,
  },
  cardImg: { width: 88, height: 88, borderRadius: 8, backgroundColor: "#F5F5F5" },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#1A1A1A", lineHeight: 18 },
  variantTag: {
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  variantTagText: { fontSize: 11, color: "#555" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 },
  cardPrice: { fontSize: 15, fontFamily: "Inter_700Bold", color: PINK },
  cardUnitPrice: { fontSize: 11, color: "#AAA" },

  /* Qty stepper */
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    overflow: "hidden",
  },
  qtyBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9F9F9",
  },
  qtyBtnDestructive: { backgroundColor: "#FEF2F2" },
  qtyValue: {
    width: 28,
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
  },

  removeBtn: { padding: 4 },

  /* Summary */
  summary: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    elevation: 8,
  },
  summaryRows: { gap: 6 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 13, color: "#666" },
  summaryValue: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#1A1A1A" },
  totalRow: { paddingTop: 6, borderTopWidth: 1, borderTopColor: "#F0F0F0", marginTop: 4 },
  totalLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  totalValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: PINK },
  checkoutBtn: {
    backgroundColor: PINK,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  checkoutBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
