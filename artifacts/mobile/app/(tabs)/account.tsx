import { Feather } from "@expo/vector-icons";
import { useGetMe, useGetCoinBalance, useGetSpinStatus, getGetMeQueryKey, getGetCoinBalanceQueryKey, getGetSpinStatusQueryKey } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/contexts/ConfigContext";
import { useTheme } from "@/contexts/ThemeContext";

function MenuItem({ icon, label, value, onPress, danger }: { icon: string; label: string; value?: string; onPress: () => void; danger?: boolean }) {
  const colors = useColors();
  return (
    <Pressable style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={onPress} testID={`menu-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <View style={[styles.menuIcon, { backgroundColor: danger ? "#FFF5F5" : colors.accent }]}>
        <Feather name={icon as any} size={18} color={danger ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
      <View style={styles.menuRight}>
        {value ? <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>{value}</Text> : null}
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const { config } = useAppConfig();
  const { siteName } = useTheme();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const enableReferral = config.featureFlags["enableReferral"] !== false;

  const { data: profile } = useGetMe({ query: { enabled: !!token, queryKey: getGetMeQueryKey() } });
  const { data: coins } = useGetCoinBalance({ query: { enabled: !!token, queryKey: getGetCoinBalanceQueryKey() } });
  const { data: spinStatus } = useGetSpinStatus({ query: { enabled: !!token && enableReferral, queryKey: getGetSpinStatusQueryKey() } });

  const me = profile ?? user;

  if (!token) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: topPad + 20, paddingHorizontal: 20, alignItems: "center", gap: 20, paddingBottom: Platform.OS === "web" ? 34 + 84 : 80 }}>
        <View style={[styles.guestIcon, { backgroundColor: colors.accent }]}>
          <Feather name="user" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.guestTitle, { color: colors.foreground }]}>Welcome to {siteName}</Text>
        <Text style={[styles.guestSubtitle, { color: colors.mutedForeground }]}>Login to access your profile, orders, and more</Text>
        <Pressable style={[styles.loginBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/auth/login" as any)} testID="btn-login">
          <Text style={styles.loginBtnText}>Login</Text>
        </Pressable>
        <Pressable style={[styles.registerBtn, { borderColor: colors.primary }]} onPress={() => router.push("/auth/register" as any)} testID="btn-register">
          <Text style={[styles.registerBtnText, { color: colors.primary }]}>Create Account</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 + 84 : 80 }}>
      {/* Profile header */}
      <View style={[styles.profileHeader, { paddingTop: topPad + 16, backgroundColor: colors.primary }]}>
        <View style={styles.profileRow}>
          {me?.avatarUrl ? (
            <Image source={{ uri: me.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
              <Feather name="user" size={28} color="#fff" />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{me?.name ?? "User"}</Text>
            <Text style={styles.profileEmail}>{me?.email ?? ""}</Text>
            {me?.phone ? <Text style={styles.profilePhone}>{me.phone}</Text> : null}
          </View>
          <Pressable onPress={() => router.push("/profile-edit" as any)} testID="btn-edit-profile">
            <Feather name="edit-2" size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Coins & stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{coins?.balance ?? 0}</Text>
            <Text style={styles.statLabel}>Coins</Text>
          </View>
          {enableReferral && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{me?.referralCode ?? ""}</Text>
                <Text style={styles.statLabel}>Referral Code</Text>
              </View>
              <View style={styles.statDivider} />
              <Pressable style={styles.statItem} onPress={() => router.push("/spin-wheel" as any)} testID="btn-spin">
                <Text style={[styles.statValue, spinStatus?.canSpin ? { color: "#FFD700" } : {}]}>
                  {spinStatus?.canSpin ? "Spin!" : "Spun"}
                </Text>
                <Text style={styles.statLabel}>Daily Spin</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Menu */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ORDERS</Text>
        <MenuItem icon="package" label="My Orders" onPress={() => router.push("/orders" as any)} />
        <MenuItem icon="heart" label="Wishlist" onPress={() => router.push("/wishlist" as any)} />
        <MenuItem icon="map-pin" label="Addresses" onPress={() => router.push("/addresses" as any)} />
        <MenuItem icon="bell" label="Notifications" onPress={() => router.push("/notifications" as any)} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACCOUNT</Text>
        {enableReferral && (
          <>
            <MenuItem icon="gift" label="Referrals & Coins" onPress={() => router.push("/referrals" as any)} />
            <MenuItem icon="rotate-cw" label="Spin & Win" onPress={() => router.push("/spin-wheel" as any)} />
          </>
        )}
        <MenuItem icon="settings" label="Settings" onPress={() => router.push("/settings" as any)} />
        <MenuItem icon="help-circle" label="Help & Support" onPress={() => router.push("/(tabs)/messages" as any)} />
      </View>

      <View style={styles.section}>
        <MenuItem icon="log-out" label="Logout" onPress={() => logout()} danger />
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>Shohure v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  guestIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  guestTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  guestSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  loginBtn: { width: "100%", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  loginBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 },
  registerBtn: { width: "100%", paddingVertical: 14, borderRadius: 14, alignItems: "center", borderWidth: 1.5 },
  registerBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  profileHeader: { paddingHorizontal: 20, paddingBottom: 20 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 2 },
  profilePhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 1 },
  statsRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 14, padding: 12 },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.3)", marginVertical: 4 },
  statValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 2 },
  section: { paddingTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  menuValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
  version: { textAlign: "center", fontSize: 12, marginTop: 24, marginBottom: 8, fontFamily: "Inter_400Regular" },
});
