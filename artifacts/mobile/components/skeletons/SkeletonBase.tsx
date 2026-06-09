// ── Feature 2: Skeleton Loading Screens ──
// Reusable animated skeleton components using react-native-reanimated.
// These mimic the layout of actual content during loading states.

import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
} from "react-native-reanimated";

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = "100%", height, borderRadius = 6, style }: SkeletonBoxProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(shimmer.value, [0, 1], ["#E8E8E8", "#F5F5F5"]),
  }));

  return (
    <Animated.View
      style={[animatedStyle, { width, height, borderRadius }, style]}
    />
  );
}

// ── Product Card Skeleton ──
export function ProductCardSkeleton() {
  return (
    <View style={styles.productCard}>
      <SkeletonBox height={160} borderRadius={10} />
      <View style={{ marginTop: 8, gap: 6 }}>
        <SkeletonBox height={12} width="80%" />
        <SkeletonBox height={10} width="50%" />
        <SkeletonBox height={14} width="40%" />
      </View>
    </View>
  );
}

// ── Product Grid Skeleton (2-column) ──
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.productGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ── Category Sidebar Skeleton ──
export function CategorySidebarSkeleton({ count = 8 }: { count?: number }) {
  return (
    <View style={styles.categorySidebar}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.categoryItem}>
          <SkeletonBox height={48} width={48} borderRadius={10} />
          <SkeletonBox height={10} width={44} style={{ marginTop: 5 }} />
        </View>
      ))}
    </View>
  );
}

// ── Order List Item Skeleton ──
export function OrderItemSkeleton() {
  return (
    <View style={styles.orderItem}>
      <SkeletonBox height={56} width={56} borderRadius={8} />
      <View style={{ flex: 1, gap: 6, marginLeft: 12 }}>
        <SkeletonBox height={12} width="70%" />
        <SkeletonBox height={10} width="40%" />
        <SkeletonBox height={10} width="55%" />
      </View>
      <SkeletonBox height={24} width={70} borderRadius={12} />
    </View>
  );
}

// ── Product Detail Skeleton ──
export function ProductDetailSkeleton() {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <SkeletonBox height={300} borderRadius={12} />
      <View style={{ gap: 8 }}>
        <SkeletonBox height={16} width="90%" />
        <SkeletonBox height={14} width="60%" />
        <SkeletonBox height={20} width="35%" />
      </View>
      <SkeletonBox height={1} />
      <View style={{ gap: 6 }}>
        {[1, 2, 3].map(i => <SkeletonBox key={i} height={12} />)}
        <SkeletonBox height={12} width="70%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  productCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 12,
  },
  categorySidebar: {
    width: 72,
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
  },
  categoryItem: {
    alignItems: "center",
    paddingVertical: 6,
  },
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#fff",
    marginBottom: 8,
    borderRadius: 10,
  },
});
