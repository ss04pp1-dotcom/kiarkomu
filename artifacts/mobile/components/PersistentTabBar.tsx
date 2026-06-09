import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const TABS = [
  { name: "Home", icon: "home", path: "/(tabs)/", match: ["/", "/(tabs)/", "/(tabs)/index"] },
  { name: "Categories", icon: "grid", path: "/(tabs)/categories", match: ["/categories"] },
  { name: "Message", icon: "message-circle", path: "/(tabs)/messages", match: ["/messages"] },
  { name: "Cart", icon: "shopping-cart", path: "/(tabs)/cart", match: ["/cart"] },
  { name: "Account", icon: "user", path: "/(tabs)/account", match: ["/account"] },
] as const;

const HIDDEN_ON = ["/auth/login", "/auth/register"];

function CartIcon({ color, size }: { color: string; size: number }) {
  const { token } = useAuth();
  const { data: cart } = useGetCart({
    query: {
      enabled: !!token,
      queryKey: getGetCartQueryKey(),
      staleTime: 0,           // always re-validate when focused
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  });
  const count = (cart?.items ?? []).length;
  return (
    <View style={{ width: size + 8, height: size + 8, alignItems: "center", justifyContent: "center" }}>
      <Feather name="shopping-cart" size={size} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </View>
  );
}

export default function PersistentTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const bottomPad = insets.bottom > 0 ? insets.bottom + 6 : 12;
  const barHeight = 52 + bottomPad;

  return (
    <View style={[styles.bar, { height: barHeight, paddingBottom: bottomPad }]}>
      {TABS.map((tab) => {
        const isActive =
          tab.match.some((m) => pathname === m) ||
          (tab.name === "Home" && (pathname === "/" || pathname === ""));
        const iconColor = isActive ? colors.primary : "#9E9E9E";

        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => {
              Haptics.selectionAsync(); // Feature 8: SelectionFeedback on tab change
              router.navigate(tab.path as any);
            }}
            testID={`tab-${tab.name.toLowerCase()}`}
          >
            {tab.name === "Cart" ? (
              <CartIcon color={iconColor} size={22} />
            ) : (
              <Feather name={tab.icon as any} size={22} color={iconColor} />
            )}
            <Text style={[styles.label, { color: iconColor }]}>{tab.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#E91E63",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    lineHeight: 14,
  },
});
