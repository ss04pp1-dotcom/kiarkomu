import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";

const PINK = "#E91E63";
const BLUE = "#1565C0";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packing", label: "Packing" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  pending:          { color: "#D97706", bg: "#FFFBEB", icon: "schedule" },
  confirmed:        { color: BLUE,     bg: "#EFF6FF", icon: "check-circle" },
  packing:          { color: "#7C3AED", bg: "#F5F3FF", icon: "inventory-2" },
  shipped:          { color: "#0891B2", bg: "#ECFEFF", icon: "local-shipping" },
  out_for_delivery: { color: "#4F46E5", bg: "#EEF2FF", icon: "delivery-dining" },
  delivered:        { color: "#16A34A", bg: "#F0FDF4", icon: "check-circle" },
  cancelled:        { color: "#EF4444", bg: "#FEF2F2", icon: "cancel" },
  returned:         { color: "#6B7280", bg: "#F9FAFB", icon: "assignment-return" },
};

const PAY_METHOD_LABEL: Record<string, string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  card: "Card",
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  if (!token) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} testID="btn-back">
            <Feather name="arrow-left" size={20} color="#1A1A1A" />
          </Pressable>
          <Text style={styles.headerTitle}>My Orders</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Feather name="package" size={64} color="#DDD" />
          <Text style={styles.emptyTitle}>Login to view orders</Text>
          <Text style={styles.emptySubtitle}>Track your purchases in one place</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.push("/auth/login" as any)}>
            <Text style={styles.shopBtnText}>Login / Register</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { data, isLoading } = useListOrders(
    { status: activeTab === "all" ? undefined : activeTab },
    {
      query: {
        enabled: !!token,
        queryKey: getListOrdersQueryKey({
          status: activeTab === "all" ? undefined : activeTab,
        }),
      },
    }
  );
  const orders = data?.orders ?? [];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} testID="btn-back">
          <Feather name="arrow-left" size={20} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Status filter tabs */}
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
        >
          {STATUS_TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(t.key)}
                testID={`tab-${t.key}`}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Order list */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <View style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>Loading orders…</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item: any) => String(item.id)}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Feather name="package" size={64} color="#DDD" />
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === "all"
                  ? "You haven't placed any orders yet"
                  : `No ${activeTab.replace(/_/g, " ")} orders`}
              </Text>
              {activeTab === "all" && (
                <Pressable
                  style={styles.shopBtn}
                  onPress={() => router.push("/(tabs)" as any)}
                >
                  <Text style={styles.shopBtnText}>Start Shopping</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }: { item: any }) => {
            const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
            const isActive =
              item.status !== "delivered" && item.status !== "cancelled" && item.status !== "returned";
            return (
              <Pressable
                style={styles.orderCard}
                onPress={() => router.push(`/order/${item.id}` as any)}
                testID={`order-card-${item.id}`}
              >
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.orderId}>Order #{item.id}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(item.createdAt).toLocaleDateString("en-BD", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <MaterialIcons name={cfg.icon} size={13} color={cfg.color} />
                    <Text style={[styles.statusText, { color: cfg.color }]}>
                      {item.status.replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Mid row — items count + total */}
                <View style={styles.cardMid}>
                  <View style={styles.cardMidLeft}>
                    <Text style={styles.itemCountText}>
                      {item.itemCount ?? "—"} item{(item.itemCount ?? 0) !== 1 ? "s" : ""}
                    </Text>
                    <View style={styles.payMethodRow}>
                      <Feather
                        name={item.paymentMethod === "cod" ? "dollar-sign" : "credit-card"}
                        size={12}
                        color="#888"
                      />
                      <Text style={styles.payMethodText}>
                        {PAY_METHOD_LABEL[item.paymentMethod] ?? item.paymentMethod}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.totalCol}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                      ৳{Number(item.total).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Payment status pill */}
                <View style={styles.cardBottom}>
                  <View
                    style={[
                      styles.payStatusBadge,
                      {
                        backgroundColor:
                          item.paymentStatus === "paid" ? "#DCFCE7" : "#FEF3C7",
                      },
                    ]}
                  >
                    <Text style={[styles.payStatusText, { color: item.paymentStatus === "paid" ? "#16A34A" : "#D97706" }]}>
                      {item.paymentStatus === "paid"
                        ? (item.payDeliveryCharge ? "Delivery Fee Paid" : "Paid")
                        : (["pending", "pending_verification"].includes(item.paymentStatus) ? "Verifying" : "Unpaid")}
                    </Text>
                  </View>

                  {isActive && (
                    <View style={styles.trackBtn}>
                      <MaterialIcons name="location-on" size={13} color={PINK} />
                      <Text style={styles.trackBtnText}>Track Order</Text>
                      <Feather name="chevron-right" size={13} color={PINK} />
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
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

  tabsWrap: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  tabActive: { backgroundColor: PINK },
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#555" },
  tabTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingSpinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: PINK,
    borderTopColor: "transparent",
  },
  loadingText: { fontSize: 13, color: "#999" },

  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#333" },
  emptySubtitle: { fontSize: 13, color: "#888", textAlign: "center" },
  shopBtn: {
    marginTop: 8,
    backgroundColor: PINK,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shopBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    elevation: 1,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderId: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  orderDate: { fontSize: 12, color: "#888", marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  divider: { height: 1, backgroundColor: "#F3F4F6" },
  cardMid: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardMidLeft: { gap: 4 },
  itemCountText: { fontSize: 13, color: "#555", fontFamily: "Inter_500Medium" },
  payMethodRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  payMethodText: { fontSize: 12, color: "#888" },
  totalCol: { alignItems: "flex-end" },
  totalLabel: { fontSize: 11, color: "#888" },
  totalValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: PINK },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  payStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  payStatusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  trackBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  trackBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: PINK },
});
