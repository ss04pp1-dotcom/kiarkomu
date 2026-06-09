import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlert } from "@/contexts/AlertContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/contexts/ConfigContext";
import { API_BASE_URL } from "@/lib/config";

const MFS_CONFIG: Record<string, { label: string; color: string; logo: string }> = {
  bkash:  { label: "bKash",  color: "#E91E63", logo: "B" },
  nagad:  { label: "Nagad",  color: "#F97316", logo: "N" },
  rocket: { label: "Rocket", color: "#8B5CF6", logo: "R" },
};

const PAYMENT_REQUIRED_TITLE   = "Payment Required";
const PAYMENT_REQUIRED_MESSAGE = "Please submit your payment transaction details to complete your order.";

export default function PaymentInstructionScreen() {
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const navigation = useNavigation();
  const { token }  = useAuth();
  const { config: s } = useAppConfig();
  const { showAlert } = useAlert();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const queryClient = useQueryClient();
  const [transactionId, setTransactionId] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Block Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (submitted) return false; // Allow going back if payment is submitted
      showAlert({ title: PAYMENT_REQUIRED_TITLE, message: PAYMENT_REQUIRED_MESSAGE });
      return true; // prevents default back action
    });
    return () => sub.remove();
  }, [submitted]); 

  // Block swipe-back gesture and navigation stack pop (iOS + Expo Router)
  useEffect(() => {
    const unsubscribe = (navigation as any).addListener("beforeRemove", (e: any) => {
      if (submitted) return; // Allow going back if payment is submitted
      e.preventDefault();
      showAlert({ title: PAYMENT_REQUIRED_TITLE, message: PAYMENT_REQUIRED_MESSAGE });
    });
    return unsubscribe;
  }, [navigation, submitted]); 

  const {
    orderId,
    method,
    payableAmount: payableAmountStr,
    payDeliveryCharge: payDeliveryChargeParam,
    deliveryFee: deliveryFeeStr,
    productTotal: productTotalStr,
  } = useLocalSearchParams<{
    orderId?: string;
    method?: string;
    payableAmount?: string;
    payDeliveryCharge?: string;
    deliveryFee?: string;
    productTotal?: string;
  }>();

  const payDeliveryChargeActive = payDeliveryChargeParam === "1";
  
  const payableAmountFromParam = payableAmountStr ? parseFloat(payableAmountStr) : 0;
  const deliveryFee = deliveryFeeStr ? parseFloat(deliveryFeeStr) : 0;
  const productTotal = productTotalStr ? parseFloat(productTotalStr) : 0;

  // Fetch order to display amount and order reference
  const { data: order } = useGetOrder(Number(orderId), {
    query: {
      enabled: !!orderId && !!token,
      queryKey: getGetOrderQueryKey(Number(orderId)),
    },
  });

  const mfsInfo = MFS_CONFIG[method ?? ""] ?? MFS_CONFIG.bkash;

  const merchantNumber =
    method === "bkash"  ? (s?.bkashNumber  || null) :
    method === "nagad"  ? (s?.nagadNumber  || null) :
    method === "rocket" ? (s?.rocketNumber || null) :
    null;
  const numberLabel =
    method === "bkash"  ? (s?.bkashNumberLabel  || "PERSONAL NUMBER") :
    method === "nagad"  ? (s?.nagadNumberLabel  || "Nagad Number")    :
    method === "rocket" ? (s?.rocketNumberLabel || "Rocket Number")   :
    "Number";
  const txnLabel =
    method === "bkash"  ? (s?.bkashTxnLabel  || "Transaction ID (TrxID)") :
    method === "nagad"  ? (s?.nagadTxnLabel  || "Transaction ID (TrxID)") :
    method === "rocket" ? (s?.rocketTxnLabel || "Transaction ID (TrxID)") :
    "Transaction ID (TrxID)";
  const logoUrl =
    method === "bkash"  ? s?.bkashLogoUrl  :
    method === "nagad"  ? s?.nagadLogoUrl  :
    method === "rocket" ? s?.rocketLogoUrl :
    null;

  const displayAmount = payableAmountFromParam > 0
    ? payableAmountFromParam
    : order ? Number(order.total) : 0;

  const displayOrderId = orderId;

  const handleSubmit = async () => {
    if (!transactionId.trim()) {
      showAlert({ title: "Required", message: "Please enter your Transaction ID" });
      return;
    }
    if (!senderNumber.trim() || senderNumber.replace(/\D/g, "").length < 11) {
      showAlert({ title: "Required", message: "Please enter a valid sender mobile number" });
      return;
    }
    setSubmitting(true);
    try {
      const submitRes = await fetch(
        `${API_BASE_URL}/api/orders/${orderId}/submit-payment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ transactionId: transactionId.trim(), senderNumber: senderNumber.trim() }),
        }
      );
      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Submission failed");
      }
      await queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(Number(orderId)) });
      showAlert({ title: "Payment submitted!", message: `Transaction ID received. Order #${orderId} is pending verification.` });
      setSubmitted(true);
    } catch (err: any) {
      showAlert({ title: "Error", message: err.message ?? "Failed to submit. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { backgroundColor: "#F0FDF4" }]}>
            <MaterialIcons name="check-circle" size={64} color="#16A34A" />
          </View>
          <Text style={styles.successTitle}>Payment Submitted!</Text>
          <Text style={styles.successSubtitle}>
            Your Transaction ID has been received. Our team will verify your payment within 1–2 hours and update your order status.
          </Text>
          {payDeliveryChargeActive && (
            <View style={[styles.refBox, { backgroundColor: "#FFF3E0", borderColor: "#FED7AA" }]}>
              <Text style={[styles.refLabel, { color: "#9A3412" }]}>Due on Delivery (Cash)</Text>
              <Text style={[styles.refValue, { color: "#EA580C" }]}>৳{productTotal.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.refBox}>
            <Text style={styles.refLabel}>Transaction ID</Text>
            <Text style={styles.refValue}>{transactionId}</Text>
          </View>
          <Pressable
            style={[styles.btn, { backgroundColor: mfsInfo.color }]}
            onPress={() => router.replace(`/order/${displayOrderId}` as any)}
          >
            <Text style={styles.btnText}>View Order Status</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={() => router.replace("/(tabs)" as any)}>
            <Text style={styles.linkText}>Continue Shopping</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: topPad }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={() => showAlert({ title: PAYMENT_REQUIRED_TITLE, message: PAYMENT_REQUIRED_MESSAGE })}
          >
            <Feather name="arrow-left" size={20} color="#1A1A1A" />
          </Pressable>
          <Text style={styles.headerTitle}>{mfsInfo.label} Payment</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Amount card */}
          <View style={[styles.amountCard, { borderColor: mfsInfo.color + "40", backgroundColor: mfsInfo.color + "08" }]}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoImg} resizeMode="contain" />
            ) : (
              <View style={[styles.logoCircle, { backgroundColor: mfsInfo.color }]}>
                <Text style={styles.logoText}>{mfsInfo.logo}</Text>
              </View>
            )}
            {payDeliveryChargeActive ? (
              <>
                <Text style={styles.amountLabel}>Payable Now (Delivery Charge)</Text>
                <Text style={[styles.amountValue, { color: mfsInfo.color }]}>
                  ৳ {displayAmount.toLocaleString("en-BD")}
                </Text>
                <View style={styles.partialBadge}>
                  <Text style={styles.partialBadgeText}>
                    Due on Delivery: ৳{productTotal.toLocaleString("en-BD")} (COD)
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.amountLabel}>Total Amount to Send</Text>
                <Text style={[styles.amountValue, { color: mfsInfo.color }]}>
                  ৳ {displayAmount.toLocaleString("en-BD")}
                </Text>
              </>
            )}
            {displayOrderId && (
              <Text style={styles.orderId}>Order #{displayOrderId}</Text>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to pay</Text>
            {[
              `Open your ${mfsInfo.label} app`,
              `Go to "Send Money"`,
              merchantNumber
                ? `Send ৳${displayAmount.toFixed(2)} to ${numberLabel}: ${merchantNumber}`
                : `Send ৳${displayAmount.toFixed(2)} to our ${mfsInfo.label} number`,
              displayOrderId
                ? `Use your Order #${displayOrderId} as the reference`
                : "Come back here after placing the order and enter your Transaction ID",
              "Come back here and enter your Transaction ID below",
            ].map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepNum, { backgroundColor: mfsInfo.color }]}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}

            {merchantNumber && (
              <View style={[styles.merchantBox, { borderColor: mfsInfo.color + "60", backgroundColor: mfsInfo.color + "08" }]}>
                <Text style={styles.merchantLabel}>{numberLabel}</Text>
                <Text style={[styles.merchantNumber, { color: mfsInfo.color }]}>{merchantNumber}</Text>
              </View>
            )}
          </View>

          {/* Input fields */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Enter Payment Details</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{txnLabel} *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. AAB1234XYZ"
                placeholderTextColor="#9CA3AF"
                value={transactionId}
                onChangeText={setTransactionId}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Your {mfsInfo.label} Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="01XXXXXXXXX"
                placeholderTextColor="#9CA3AF"
                value={senderNumber}
                onChangeText={setSenderNumber}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <Pressable
            style={[styles.btn, { backgroundColor: mfsInfo.color, opacity: submitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Submit Payment</Text>
            )}
          </Pressable>

          <Text style={styles.note}>
            ⚠️ Your order will be confirmed once our team verifies the transaction. This usually takes up to 2 hours.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  header: {
    height: 56, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
    backgroundColor: "#FFF",
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#1A1A1A" },
  scroll: { padding: 16, paddingBottom: 40 },
  amountCard: {
    borderRadius: 16, borderWidth: 1.5, padding: 24,
    alignItems: "center", marginBottom: 24,
  },
  logoCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  logoImg: { width: 56, height: 56, borderRadius: 28, marginBottom: 12, backgroundColor: "#fff" },
  logoText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  amountLabel: { fontSize: 13, color: "#6B7280", marginBottom: 4 },
  amountValue: { fontSize: 36, fontWeight: "800", marginBottom: 4 },
  orderId: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  partialBadge: { marginTop: 8, backgroundColor: "#FFF3E0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  partialBadgeText: { fontSize: 13, color: "#EA580C", fontWeight: "600" },
  section: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#F0F0F0" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 14 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 },
  stepNumText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stepText: { flex: 1, fontSize: 14, color: "#374151", lineHeight: 20 },
  merchantBox: { borderRadius: 10, borderWidth: 1.5, padding: 14, alignItems: "center", marginTop: 8 },
  merchantLabel: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  merchantNumber: { fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: "#1A1A1A", backgroundColor: "#FFF",
  },
  btn: {
    borderRadius: 12, paddingVertical: 15, alignItems: "center",
    marginTop: 4, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  btnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  note: { fontSize: 12, color: "#6B7280", textAlign: "center", lineHeight: 18, paddingHorizontal: 8 },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  successIcon: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 12 },
  successSubtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  refBox: { backgroundColor: "#F9FAFB", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, width: "100%", alignItems: "center", marginBottom: 12 },
  refLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 4 },
  refValue: { fontSize: 18, fontWeight: "700", color: "#1A1A1A", fontVariant: ["tabular-nums"] },
  linkBtn: { marginTop: 8 },
  linkText: { fontSize: 14, color: "#6B7280", textDecorationLine: "underline" },
});