import { Feather } from "@expo/vector-icons";
import { useGetCoinBalance, useGetMe, getGetMeQueryKey, getGetCoinBalanceQueryKey } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  Clipboard,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";

const PINK = "#E91E63";
const GOLD = "#F59E0B";

const HOW_IT_WORKS = [
  { icon: "share-2", title: "Share Your Code", desc: "Share your unique referral code with friends and family." },
  { icon: "user-plus", title: "Friend Signs Up", desc: "Your friend creates an account using your referral code." },
  { icon: "gift", title: "Both Earn Coins", desc: "You both receive 50 coins when they complete registration." },
  { icon: "shopping-bag", title: "Redeem at Checkout", desc: "Use coins to get discounts on your next order." },
];

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { showAlert } = useAlert();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const { data: profile } = useGetMe({ query: { enabled: !!token, queryKey: getGetMeQueryKey() } });
  const { data: coins } = useGetCoinBalance({ query: { enabled: !!token, queryKey: getGetCoinBalanceQueryKey() } });

  const referralCode = (profile as any)?.referralCode ?? "—";
  const balance = (coins as any)?.balance ?? 0;
  const coinValue = (coins as any)?.coinValue ?? 0.1;

  const handleCopy = () => {
    Clipboard.setString(referralCode);
    showAlert({ title: "Copied!", message: `Referral code "${referralCode}" copied to clipboard.` });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join Shohure and get 50 bonus coins! Use my referral code: ${referralCode}\nDownload now and start shopping!`,
        title: "Shohure Referral",
      });
    } catch (err: any) {
      // Ignore user-dismiss (AbortError / action === dismissedAction); surface real errors
      if (err?.name !== "AbortError" && err?.message !== "User did not share") {
        console.warn("Share failed:", err?.message);
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>Referrals & Coins</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Coins balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.coinIconWrap}>
            <Feather name="star" size={28} color={GOLD} />
          </View>
          <Text style={styles.balanceLabel}>Your Coin Balance</Text>
          <Text style={styles.balanceValue}>{balance}</Text>
          <Text style={styles.balanceSub}>≈ ৳{(balance * coinValue).toFixed(2)} discount at checkout</Text>
        </View>

        {/* Referral code card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Referral Code</Text>
          <View style={styles.codeCard}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{referralCode}</Text>
            </View>
            <Pressable style={styles.copyBtn} onPress={handleCopy}>
              <Feather name="copy" size={15} color={PINK} />
              <Text style={styles.copyBtnText}>Copy</Text>
            </Pressable>
          </View>
          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <Feather name="share-2" size={16} color="#fff" />
            <Text style={styles.shareBtnText}>Share Referral Code</Text>
          </Pressable>
        </View>

        {/* How it works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepsCard}>
            {HOW_IT_WORKS.map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepIconWrap}>
                  <Feather name={step.icon as any} size={18} color={PINK} />
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Coin earning guide */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ways to Earn Coins</Text>
          <View style={styles.earnCard}>
            {[
              { icon: "user-plus", label: "Refer a Friend", coins: "+50" },
              { icon: "rotate-cw", label: "Daily Spin", coins: "+10–100" },
              { icon: "star", label: "Sign Up Bonus", coins: "+50" },
            ].map((item, i) => (
              <View key={i} style={[styles.earnRow, i < 2 && styles.earnDivider]}>
                <View style={styles.earnIcon}>
                  <Feather name={item.icon as any} size={16} color={PINK} />
                </View>
                <Text style={styles.earnLabel}>{item.label}</Text>
                <Text style={styles.earnCoins}>{item.coins} coins</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#EEEEEE",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1A1A1A" },

  balanceCard: {
    margin: 16, borderRadius: 18, padding: 24, alignItems: "center",
    backgroundColor: "#fff",
    elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,
  },
  coinIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFFBEB", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  balanceLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#9E9E9E", marginBottom: 4 },
  balanceValue: { fontSize: 48, fontFamily: "Inter_700Bold", color: GOLD, lineHeight: 56 },
  balanceSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9E9E9E", marginTop: 4 },

  section: { paddingHorizontal: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1A1A1A", marginBottom: 10 },

  codeCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  codeBox: { flex: 1, backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: "#EEE", borderStyle: "dashed" },
  codeText: { fontSize: 20, fontFamily: "Inter_700Bold", color: PINK, letterSpacing: 3, textAlign: "center" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: PINK },
  copyBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: PINK },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: PINK, borderRadius: 12, paddingVertical: 14 },
  shareBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  stepsCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 16, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FFF0F5", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepText: { flex: 1 },
  stepTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1A1A1A", marginBottom: 2 },
  stepDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#757575", lineHeight: 17 },

  earnCard: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  earnRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  earnDivider: { borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  earnIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#FFF0F5", alignItems: "center", justifyContent: "center" },
  earnLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#1A1A1A" },
  earnCoins: { fontSize: 13, fontFamily: "Inter_700Bold", color: GOLD },
});
