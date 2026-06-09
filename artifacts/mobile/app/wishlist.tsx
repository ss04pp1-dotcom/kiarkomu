import { Feather } from "@expo/vector-icons";
import {
  useGetWishlist,
  useRemoveFromWishlist,
  getGetWishlistQueryKey,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";

const PINK = "#E91E63";
const BLUE = "#1565C0";

export default function WishlistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const { data, isLoading } = useGetWishlist({
    query: { enabled: !!token, queryKey: getGetWishlistQueryKey() },
  });
  const items = Array.isArray(data) ? data : [];

  const removeFromWishlist = useRemoveFromWishlist();

  const handleRemove = (productId: number) => {
    removeFromWishlist.mutate(
      { productId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() });
        },
        onError: () => {
          showAlert({ title: "Error", message: "Failed to remove from wishlist" });
        },
      }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>My Wishlist</Text>
        <View style={{ width: 40 }} />
      </View>

      {!token ? (
        <View style={styles.emptyState}>
          <Feather name="heart" size={52} color="#DDD" />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign in to view wishlist</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Login to save products you love
          </Text>
          <Pressable
            style={styles.loginBtn}
            onPress={() => router.push("/auth/login" as any)}
          >
            <Text style={styles.loginBtnText}>Login</Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={PINK} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="heart" size={52} color="#DDD" />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your wishlist is empty</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Tap the heart icon on any product to save it here
          </Text>
          <Pressable
            style={styles.browseBtn}
            onPress={() => router.push("/" as any)}
          >
            <Text style={styles.browseBtnText}>Browse Products</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {items.length} saved item{items.length !== 1 ? "s" : ""}
          </Text>
          {items.map((item: any) => (
            <Pressable
              key={item.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/product/${item.productId}` as any)}
            >
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={styles.thumb}
                resizeMode="cover"
              />
              <View style={styles.info}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.categoryName ? (
                  <Text style={[styles.category, { color: colors.mutedForeground }]}>
                    {item.categoryName}
                  </Text>
                ) : null}
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: PINK }]}>
                    ৳{Number(item.price).toLocaleString()}
                  </Text>
                  {item.originalPrice ? (
                    <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>
                      ৳{Number(item.originalPrice).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
                {item.stock === 0 ? (
                  <Text style={styles.outOfStock}>Out of Stock</Text>
                ) : (
                  <Text style={[styles.inStock, { color: "#16A34A" }]}>In Stock</Text>
                )}
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => handleRemove(item.productId)}
                  testID={`btn-wishlist-remove-${item.productId}`}
                >
                  <Feather name="heart" size={20} color={PINK} />
                </Pressable>
                <Pressable
                  style={[styles.cartBtn, { backgroundColor: BLUE }]}
                  onPress={() => router.push(`/product/${item.productId}` as any)}
                >
                  <Feather name="shopping-cart" size={15} color="#fff" />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100, gap: 10 },
  count: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
  card: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    gap: 12,
    padding: 10,
  },
  thumb: { width: 90, height: 90, borderRadius: 8 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  category: { fontSize: 11, fontFamily: "Inter_400Regular" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  price: { fontSize: 16, fontFamily: "Inter_700Bold" },
  originalPrice: { fontSize: 12, textDecorationLine: "line-through" },
  outOfStock: { fontSize: 11, color: "#EF4444", fontFamily: "Inter_500Medium" },
  inStock: { fontSize: 11, fontFamily: "Inter_500Medium" },
  actions: { alignItems: "center", justifyContent: "space-between", gap: 8 },
  removeBtn: { padding: 6 },
  cartBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  loginBtn: { backgroundColor: PINK, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12, marginTop: 8 },
  loginBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  browseBtn: { backgroundColor: BLUE, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12, marginTop: 8 },
  browseBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
