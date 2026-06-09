import { Feather } from "@expo/vector-icons";
import { useListCategories, useListProducts } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const [selectedCat, setSelectedCat] = useState<number | null>(
    params.categoryId ? parseInt(params.categoryId) : null
  );

  const { data: categoriesData, refetch: refetchCats } = useListCategories();
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const [refreshing, setRefreshing] = useState(false);

  const { data: productsData, isLoading, isError, refetch: refetchProducts } = useListProducts(
    selectedCat !== null ? { categoryId: selectedCat, limit: 40 } as any : { limit: 40 } as any
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchCats(), refetchProducts()]);
    setRefreshing(false);
  };
  const products = productsData?.products ?? [];

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Categories</Text>
        <Pressable
          style={[styles.searchBar, { backgroundColor: colors.input }]}
          onPress={() => router.push("/search" as any)}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <Text style={[styles.searchInput, { color: colors.mutedForeground }]}>Search products...</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Category sidebar */}
        <View style={[styles.sidebar, { backgroundColor: colors.card, borderRightColor: colors.border }]}>
          <FlatList
            data={[{ id: null, name: "All" }, ...categories] as any[]}
            keyExtractor={(item: any) => String(item.id ?? "all")}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.sidebarItem,
                  selectedCat === item.id && { backgroundColor: colors.accent, borderRightColor: colors.primary, borderRightWidth: 3 },
                ]}
                onPress={() => setSelectedCat(item.id)}
                testID={`sidebar-cat-${item.id}`}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.sidebarIcon} />
                ) : (
                  <View style={[styles.sidebarIconPlaceholder, { backgroundColor: colors.secondary }]}>
                    <Feather name="grid" size={14} color={colors.mutedForeground} />
                  </View>
                )}
                <Text style={[
                  styles.sidebarText,
                  { color: selectedCat === item.id ? colors.primary : colors.foreground },
                ]} numberOfLines={2}>
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
        </View>

        {/* Product grid */}
        {isLoading ? (
          <View style={styles.loadingState}>
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item: any) => String(item.id)}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 8, paddingBottom: Platform.OS === "web" ? 34 + 84 : 80 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#1565C0"
                colors={["#1565C0"]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="package" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No products</Text>
              </View>
            }
            renderItem={({ item }: { item: any }) => (
              <Pressable
                style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/product/${item.id}` as any)}
                testID={`product-cat-${item.id}`}
              >
                <Image
                  source={{ uri: item.thumbnailUrl }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
                {item.discountPercent ? (
                  <View style={[styles.discountBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.discountText}>{item.discountPercent}%</Text>
                  </View>
                ) : null}
                <View style={styles.productInfo}>
                  <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
                  <Text style={[styles.price, { color: colors.primary }]}>৳{Number(item.price).toLocaleString()}</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 10 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  content: { flex: 1, flexDirection: "row" },
  sidebar: { width: 90, borderRightWidth: 1 },
  sidebarItem: { padding: 10, alignItems: "center", borderRightWidth: 3, borderRightColor: "transparent" },
  sidebarIcon: { width: 32, height: 32, borderRadius: 8, marginBottom: 4 },
  sidebarIconPlaceholder: { width: 32, height: 32, borderRadius: 8, marginBottom: 4, alignItems: "center", justifyContent: "center" },
  sidebarText: { fontSize: 11, textAlign: "center", fontFamily: "Inter_500Medium", lineHeight: 14 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 14 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  productCard: { flex: 1, margin: 4, borderRadius: 10, overflow: "hidden", borderWidth: 1 },
  productImage: { width: "100%", height: 130 },
  productInfo: { padding: 8 },
  productName: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16, marginBottom: 4 },
  price: { fontSize: 14, fontFamily: "Inter_700Bold" },
  discountBadge: { position: "absolute", top: 6, left: 6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  discountText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
});
