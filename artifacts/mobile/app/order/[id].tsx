import { Feather, MaterialIcons } from "@expo/vector-icons";
import {
  useGetOrder,
  useGetOrderTracking,
  getGetOrderQueryKey,
  getGetOrderTrackingQueryKey,
  useCreateReview,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import CustomAlert from "@/components/CustomAlert";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import { useAppConfig } from "@/contexts/ConfigContext";
import { API_BASE_URL } from "@/lib/config";

const PURPLE = "#7C3AED";
const PINK = "#E91E63";

const ORDER_STEPS = [
  { key: "pending",          label: "Placed",     icon: "receipt-long"   },
  { key: "confirmed",        label: "Confirmed",  icon: "check-circle"   },
  { key: "packing",          label: "Processing", icon: "inventory-2"    },
  { key: "out_for_delivery", label: "In Transit", icon: "local-shipping"  },
  { key: "delivered",        label: "Delivered",  icon: "check-circle"   },
] as const;

const STATUS_STEP: Record<string, number> = {
  pending: 0, confirmed: 1, packing: 2,
  shipped: 3, out_for_delivery: 3, delivered: 4,
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  pending:          { bg: "#FFF3E8", color: "#F97316" },
  confirmed:        { bg: "#EFF6FF", color: "#1565C0" },
  packing:          { bg: "#F5F3FF", color: "#7C3AED" },
  shipped:          { bg: "#ECFEFF", color: "#0891B2" },
  out_for_delivery: { bg: "#EEF2FF", color: "#4F46E5" },
  delivered:        { bg: "#F0FDF4", color: "#16A34A" },
  cancelled:        { bg: "#FEF2F2", color: "#EF4444" },
  returned:         { bg: "#F9FAFB", color: "#6B7280" },
};

const PAY_METHOD_LABEL: Record<string, string> = {
  cod: "Cash on Delivery", bkash: "bKash",
  nagad: "Nagad", rocket: "Rocket", card: "Card",
};

const PAY_BRAND: Record<string, { color: string; bg: string; initials: string }> = {
  bkash:  { color: "#E2136E", bg: "#FDEEF6", initials: "bK" },
  nagad:  { color: "#F05A28", bg: "#FEF0EB", initials: "Na" },
  rocket: { color: "#8B1FA8", bg: "#F5EAFD", initials: "Ro" },
  cod:    { color: "#16A34A", bg: "#DCFCE7", initials: "₳" },
  card:   { color: "#1565C0", bg: "#DBEAFE", initials: "💳" },
};

const PAY_METHOD_COLOR: Record<string, string> = {
  bkash: "#E2136E", nagad: "#F05A28", rocket: "#8B1FA8", cod: "#16A34A", card: "#1565C0",
};

const COURIER_TRACK_URL: Record<string, (id: string) => string> = {
  steadfast: (code) => `https://steadfast.com.bd/t/${code}`,
  carrybee:  (id)   => `https://carrybee.com.bd/tracking/${id}`,
};

/* ─── Write Review Modal ─────────────────────────────────────────── */
function WriteReviewModal({
  visible, productId, orderItemId, onClose, onSuccess,
}: {
  visible: boolean; productId: number; orderItemId: number;
  onClose: () => void; onSuccess: () => void;
}) {
  const { token } = useAuth();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const createReview = useCreateReview();
  const [localAlertVisible, setLocalAlertVisible] = useState(false);
  const [localAlertTitle, setLocalAlertTitle] = useState("");
  const [localAlertMessage, setLocalAlertMessage] = useState("");

  const showLocalAlert = (title: string, message: string) => {
    setLocalAlertTitle(title); setLocalAlertMessage(message); setLocalAlertVisible(true);
  };
  const reset = () => { setStars(0); setComment(""); setPhotos([]); setSubmitted(false); };

  const pickPhoto = async () => {
    if (photos.length >= 3) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7,
      allowsEditing: true, aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.length) return;
    const uri = result.assets[0].uri;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", { uri, name: "photo.jpg", type: "image/jpeg" } as any);
      const resp = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err?.error ?? `Upload failed (${resp.status})`); }
      const data = await resp.json();
      if (data.url) setPhotos(prev => [...prev, data.url]);
    } catch (err: any) {
      showLocalAlert("Upload Failed", err?.message ?? "Could not upload photo. Please try again.");
    }
    setUploading(false);
  };

  const handleSubmit = () => {
    if (stars === 0) return;
    createReview.mutate(
      { id: productId, data: { orderItemId, rating: stars, comment: comment.trim() || undefined, images: photos } },
      { onSuccess: () => { setSubmitted(true); setTimeout(() => { reset(); onSuccess(); }, 1800); } }
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={rvStyles.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={rvStyles.sheet}>
        <View style={rvStyles.handle} />
        {submitted ? (
          <View style={rvStyles.successBox}>
            <Feather name="check-circle" size={48} color="#16A34A" />
            <Text style={rvStyles.successTitle}>Thank you!</Text>
            <Text style={rvStyles.successSub}>Your review is pending approval.</Text>
          </View>
        ) : (
          <>
            <View style={rvStyles.header}>
              <Text style={rvStyles.title}>Write a Review</Text>
              <Pressable onPress={onClose}><Feather name="x" size={20} color="#333" /></Pressable>
            </View>
            <Text style={rvStyles.label}>Your Rating *</Text>
            <View style={rvStyles.starsRow}>
              {[1,2,3,4,5].map(s => (
                <Pressable key={s} onPress={() => setStars(s)} style={rvStyles.starBtn}>
                  <Feather name="star" size={36} color={s <= stars ? "#F59E0B" : "#DDD"} />
                </Pressable>
              ))}
            </View>
            {stars > 0 && <Text style={rvStyles.starLabel}>{["","Poor","Fair","Good","Very Good","Excellent"][stars]}</Text>}
            <Text style={rvStyles.label}>Your Review</Text>
            <TextInput
              style={rvStyles.textarea} placeholder="Share your experience with this product..."
              placeholderTextColor="#aaa" value={comment} onChangeText={setComment}
              multiline numberOfLines={4} maxLength={500} textAlignVertical="top"
            />
            <Text style={rvStyles.charCount}>{comment.length}/500</Text>
            <Text style={rvStyles.label}>Add Photos (Optional)</Text>
            <View style={rvStyles.photosRow}>
              {photos.map((uri, i) => (
                <View key={i} style={rvStyles.photoThumb}>
                  <Image source={{ uri }} style={rvStyles.photoImg} />
                  <Pressable style={rvStyles.removePhoto} onPress={() => setPhotos(p => p.filter((_,j) => j !== i))}>
                    <Feather name="x" size={10} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {photos.length < 3 && (
                <Pressable style={rvStyles.addPhoto} onPress={pickPhoto} disabled={uploading}>
                  {uploading
                    ? <ActivityIndicator size="small" color={PINK} />
                    : <><Feather name="camera" size={20} color="#999" /><Text style={rvStyles.addPhotoText}>Add</Text></>}
                </Pressable>
              )}
            </View>
            <Pressable
              style={[rvStyles.submitBtn, stars === 0 && rvStyles.submitBtnDisabled]}
              onPress={handleSubmit} disabled={stars === 0 || createReview.isPending}
            >
              {createReview.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={rvStyles.submitBtnText}>Submit Review</Text>}
            </Pressable>
          </>
        )}
      </KeyboardAvoidingView>
      <CustomAlert visible={localAlertVisible} title={localAlertTitle} message={localAlertMessage} onDismiss={() => setLocalAlertVisible(false)} />
    </Modal>
  );
}

const rvStyles = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:             { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  handle:            { width: 40, height: 4, backgroundColor: "#E0E0E0", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  title:             { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  label:             { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#555", marginBottom: 8, marginTop: 14 },
  starsRow:          { flexDirection: "row", gap: 6, justifyContent: "center", marginVertical: 4 },
  starBtn:           { padding: 4 },
  starLabel:         { textAlign: "center", fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#F59E0B", marginBottom: 4 },
  textarea:          { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#333", minHeight: 90, backgroundColor: "#FAFAFA" },
  charCount:         { fontSize: 11, color: "#aaa", textAlign: "right", marginTop: 4 },
  photosRow:         { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  photoThumb:        { width: 72, height: 72, borderRadius: 8, overflow: "hidden", position: "relative" },
  photoImg:          { width: "100%", height: "100%" },
  removePhoto:       { position: "absolute", top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  addPhoto:          { width: 72, height: 72, borderRadius: 8, borderWidth: 1.5, borderColor: "#E0E0E0", borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#FAFAFA" },
  addPhotoText:      { fontSize: 10, color: "#999" },
  submitBtn:         { marginTop: 18, backgroundColor: PINK, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  submitBtnDisabled: { backgroundColor: "#ccc" },
  submitBtnText:     { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  successBox:        { alignItems: "center", paddingVertical: 40, gap: 10 },
  successTitle:      { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  successSub:        { fontSize: 13, color: "#888" },
});

/* ─── Step Progress Bar ──────────────────────────────────────────── */
function DashedLine({ done, color }: { done: boolean; color: string }) {
  return (
    <View style={{ flex: 1, height: 2, overflow: "hidden", justifyContent: "center" }}>
      <View style={{
        height: 0,
        borderTopWidth: 2,
        borderStyle: "dashed",
        borderColor: done ? color : "#D8D8D8",
      }} />
    </View>
  );
}

function StepProgress({ currentStatus, events, color }: { currentStatus: string; events: any[]; color: string }) {
  const activeStep = STATUS_STEP[currentStatus] ?? 0;
  const isCancelled = ["cancelled", "returned"].includes(currentStatus);

  const getEventTime = (stepKey: string) => {
    const statusMap: Record<string, string[]> = {
      pending: ["pending"],
      confirmed: ["confirmed"],
      packing: ["packing", "processing"],
      out_for_delivery: ["shipped", "out_for_delivery"],
      delivered: ["delivered"],
    };
    const keys = statusMap[stepKey] ?? [];
    for (const ev of events) {
      if (keys.includes(ev.status)) {
        return new Date(ev.timestamp).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      }
    }
    return null;
  };

  return (
    <View style={stepStyles.container}>
      {/* Connector row spans full width behind the circles */}
      <View style={stepStyles.connectorRow} pointerEvents="none">
        {ORDER_STEPS.map((step, idx) => {
          if (idx === ORDER_STEPS.length - 1) return null;
          const segDone = !isCancelled && activeStep > idx;
          return (
            <View key={step.key + "_line"} style={stepStyles.connectorSeg}>
              <DashedLine done={segDone} color={color} />
            </View>
          );
        })}
      </View>

      {ORDER_STEPS.map((step, idx) => {
        const done = !isCancelled && activeStep > idx;
        const active = !isCancelled && activeStep === idx;
        const time = (done || active) ? getEventTime(step.key) : null;

        return (
          <View key={step.key} style={stepStyles.stepWrap}>
            <View style={[
              stepStyles.circle,
              done && { backgroundColor: color, borderColor: color },
              active && { borderColor: color, backgroundColor: color + "22" },
            ]}>
              {done
                ? <MaterialIcons name="check" size={16} color="#fff" />
                : <MaterialIcons name={step.icon as any} size={16} color={active ? color : "#C4C4C4"} />}
            </View>
            <Text style={[stepStyles.label, (done || active) && { color, fontFamily: "Inter_700Bold" as any }]} numberOfLines={1}>
              {step.label}
            </Text>
            {time && <Text style={stepStyles.time} numberOfLines={2}>{time}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container:     { flexDirection: "row", alignItems: "flex-start", paddingVertical: 20, paddingHorizontal: 10, position: "relative" },
  connectorRow:  { position: "absolute", top: 38, left: "10%", right: "10%", flexDirection: "row" },
  connectorSeg:  { flex: 1 },
  stepWrap:      { flex: 1, alignItems: "center", zIndex: 1 },
  circle:        { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: "#D8D8D8", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  circleDone:    { backgroundColor: PURPLE, borderColor: PURPLE },
  circleActive:  { borderColor: PURPLE, backgroundColor: "#F0EBFF" },
  label:         { fontSize: 10, fontFamily: "Inter_500Medium", color: "#ADADAD", marginTop: 7, textAlign: "center" },
  labelActive:   { color: PURPLE, fontFamily: "Inter_700Bold" },
  time:          { fontSize: 9, color: "#999", marginTop: 2, textAlign: "center", lineHeight: 12 },
});

/* ─── Timeline Modal ─────────────────────────────────────────────── */
function TimelineModal({ visible, events, onClose }: {
  visible: boolean; events: any[]; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tm.overlay} onPress={onClose}>
        <Pressable style={tm.card} onPress={() => {}}>
          <View style={tm.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <MaterialIcons name="timeline" size={18} color={PURPLE} />
              <Text style={tm.title}>Order Timeline</Text>
            </View>
            <Pressable onPress={onClose} style={tm.closeBtn}>
              <Feather name="x" size={20} color="#555" />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {events.length === 0 ? (
              <Text style={tm.empty}>No events yet.</Text>
            ) : (
              events.map((event, idx) => {
                const isLatest = idx === events.length - 1;
                return (
                  <View key={event.id} style={tm.row}>
                    <View style={tm.dotCol}>
                      <View style={[tm.dot, isLatest && tm.dotActive]}>
                        {isLatest && <View style={tm.dotInner} />}
                      </View>
                      {!isLatest && <View style={tm.line} />}
                    </View>
                    <View style={tm.content}>
                      <Text style={[tm.status, isLatest && { color: PURPLE }]}>
                        {event.status.replace(/_/g, " ")}
                      </Text>
                      <Text style={tm.date}>
                        {new Date(event.timestamp).toLocaleString("en-BD", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const tm = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "center", alignItems: "center", padding: 24 },
  card:      { backgroundColor: "#fff", borderRadius: 20, width: "100%", maxHeight: "80%", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20, elevation: 12 },
  header:    { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  title:     { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  closeBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  empty:     { textAlign: "center", color: "#999", fontSize: 13, paddingVertical: 24 },
  row:       { flexDirection: "row", gap: 14, paddingVertical: 2 },
  dotCol:    { alignItems: "center", width: 20, paddingTop: 2 },
  dot:       { width: 18, height: 18, borderRadius: 9, backgroundColor: "#E0E0E0", alignItems: "center", justifyContent: "center" },
  dotActive: { backgroundColor: PURPLE },
  dotInner:  { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  line:      { flex: 1, width: 2, backgroundColor: "#EEEEEE", marginTop: 4, minHeight: 32 },
  content:   { flex: 1, paddingBottom: 24, paddingRight: 4 },
  status:    { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", textTransform: "capitalize", flexWrap: "wrap" },
  date:      { fontSize: 12, color: "#9CA3AF", fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 16 },
});

/* ─── Payment Method Logo ─────────────────────────────────────────── */
function PaymentMethodLogo({ method, logoUrl }: { method: string; logoUrl?: string | null }) {
  const key = (method ?? "").toLowerCase();
  const brand = PAY_BRAND[key];
  if (logoUrl) {
    return (
      <View style={[pml.box, { backgroundColor: brand?.bg ?? "#F3F4F6" }]}>
        <Image source={{ uri: logoUrl }} style={pml.logoImg} resizeMode="contain" />
      </View>
    );
  }
  if (!brand) {
    return (
      <View style={[pml.box, { backgroundColor: "#F3F4F6" }]}>
        <MaterialIcons name="payment" size={22} color="#6B7280" />
      </View>
    );
  }
  return (
    <View style={[pml.box, { backgroundColor: brand.bg }]}>
      {key === "bkash" ? (
        <View style={{ alignItems: "center" }}>
          <Text style={[pml.brandBig, { color: brand.color }]}>b</Text>
          <Text style={[pml.brandSmall, { color: brand.color }]}>Kash</Text>
        </View>
      ) : (
        <Text style={[pml.initials, { color: brand.color }]}>{brand.initials}</Text>
      )}
    </View>
  );
}

const pml = StyleSheet.create({
  box:        { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  logoImg:    { width: 44, height: 44, borderRadius: 10 },
  initials:   { fontSize: 18, fontFamily: "Inter_700Bold" },
  brandBig:   { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 22 },
  brandSmall: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5, lineHeight: 10 },
});

/* ─── Copy Toast ──────────────────────────────────────────────────── */
function CopyToast({ visible, message }: { visible: boolean; message: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  return (
    <Animated.View style={[ctp.wrap, { opacity }]} pointerEvents="none">
      <MaterialIcons name="check-circle" size={14} color="#fff" />
      <Text style={ctp.text}>{message}</Text>
    </Animated.View>
  );
}
const ctp = StyleSheet.create({
  wrap: { position: "absolute", bottom: 80, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1A1A1A", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, zIndex: 999, elevation: 20 },
  text: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

/* ─── Main Screen ────────────────────────────────────────────────── */
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const orderId = parseInt(id ?? "0", 10);

  const { data: order, isLoading, isError } = useGetOrder(orderId, {
    query: { queryKey: getGetOrderQueryKey(orderId), enabled: !!orderId },
  });
  const { data: trackingEvents } = useGetOrderTracking(orderId, {
    query: { queryKey: getGetOrderTrackingQueryKey(orderId), enabled: !!orderId },
  });

  const { config: appConfig, refresh: refreshConfig } = useAppConfig();
  useEffect(() => { refreshConfig(); }, []);
  const THEME = appConfig?.primaryColor ?? PURPLE;
  const { showConfirm, showAlert } = useAlert();
  const [cancelling, setCancelling] = useState(false);
  const [reviewItem, setReviewItem] = useState<{ productId: number; orderItemId: number } | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState("");
  const [copiedVisible, setCopiedVisible] = useState(false);
  const [liveTracking, setLiveTracking] = useState<any>(null);

  const fetchLiveTracking = useCallback(async () => {
    if (!orderId || !token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/tracking`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setLiveTracking(await res.json());
    } catch {}
  }, [orderId, token]);

  useEffect(() => { if (order) fetchLiveTracking(); }, [order, fetchLiveTracking]);

  const handleCopyTracking = async (text: string) => {
    try { await Clipboard.setStringAsync(text); } catch {}
    setCopiedMsg("Tracking ID copied!");
    setCopiedVisible(true);
    setTimeout(() => setCopiedVisible(false), 2200);
  };

  const handleCancelOrder = useCallback(() => {
    showConfirm(
      "Cancel Order",
      `Are you sure you want to cancel Order #${orderId}? This cannot be undone.`,
      async () => {
        setCancelling(true);
        try {
          const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/cancel`, {
            method: "POST", headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showAlert({ title: "Cannot Cancel", message: data.error ?? "Failed to cancel the order." });
            return;
          }
          queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        } catch {
          showAlert({ title: "Error", message: "Network error. Please try again." });
        } finally { setCancelling(false); }
      },
      "Cancel Order"
    );
  }, [orderId, token, showConfirm, showAlert, queryClient]);

  const handleReviewSuccess = useCallback(() => {
    setReviewItem(null);
    queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [orderId, queryClient]);

  if (isLoading) {
    return (
      <View style={[s.center, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={PURPLE} />
        <Text style={s.loadingText}>Loading order…</Text>
      </View>
    );
  }
  if (isError || !order) {
    return (
      <View style={[s.center, { paddingTop: topPad }]}>
        <Feather name="alert-circle" size={52} color="#EF4444" />
        <Text style={s.errorTitle}>Order not found</Text>
        <Text style={s.errorSub}>We couldn't load this order.</Text>
        <Pressable style={s.backLinkBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/orders")}>
          <Text style={s.backLinkText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;
  const trackingData = trackingEvents as any;
  const rawEvents = Array.isArray(trackingData?.localTracking)
    ? trackingData.localTracking
    : Array.isArray((order as any)?.tracking)
      ? (order as any).tracking
      : [];
  const events = rawEvents.length > 0 ? rawEvents : (() => {
    const synth: any[] = [{ id: -1, status: "pending", timestamp: order.createdAt, note: null }];
    if (order.status !== "pending") {
      synth.push({ id: -2, status: order.status, timestamp: order.createdAt, note: null });
    }
    return synth;
  })();
  const isActive = !["delivered", "cancelled", "returned"].includes(order.status);
  const isCancelled = ["cancelled", "returned"].includes(order.status);
  // Hide Pay Now if customer already submitted a transaction (waiting for admin to verify/reject)
  const isUnpaid = ["unpaid", "pending"].includes(String(order.paymentStatus).toLowerCase()) && !order.transactionId;
  const isMfsMethod = ["bkash", "nagad", "rocket"].includes(String(order.paymentMethod).toLowerCase());
  const methodColor = PAY_METHOD_COLOR[order.paymentMethod] ?? PURPLE;
  const canCancel = ["pending", "confirmed"].includes(order.status);

  // Payment logo URL from app config (case-insensitive method match)
  const _pm = (order.paymentMethod ?? "").toLowerCase();
  const payLogoUrl =
    _pm === "bkash"  ? appConfig?.bkashLogoUrl  :
    _pm === "nagad"  ? appConfig?.nagadLogoUrl  :
    _pm === "rocket" ? appConfig?.rocketLogoUrl :
    null;

  // Courier derived values
  const trackingId = order.carrybeeConsignmentId ?? order.trackingCode ?? null;
  const hasCourier = !!(order.courierService || trackingId);
  const courierName = order.courierService ?? null;
  const trackUrl = courierName && trackingId
    ? (COURIER_TRACK_URL[courierName.toLowerCase()]?.(trackingId) ?? null)
    : null;
  const steadfastStatus = liveTracking?.steadfast?.delivery_status ?? null;
  const carrybeeStatus = liveTracking?.carrybee?.transferStatus ?? null;
  const liveStatus = steadfastStatus ?? carrybeeStatus ?? null;

  const payStatusLabel =
    order.paymentStatus === "paid"
      ? (order.payDeliveryCharge ? "Delivery Charge Paid" : "Paid")
      : (["pending", "pending_verification"].includes(order.paymentStatus) ? "Verifying" : "Unpaid");

  const payStatusColor =
    order.paymentStatus === "paid" ? "#16A34A"
    : ["pending", "pending_verification"].includes(order.paymentStatus) ? "#F97316"
    : "#EF4444";

  const orderDateStr = new Date(order.createdAt).toLocaleDateString("en-BD", {
    day: "numeric", month: "long", year: "numeric",
  });
  const orderTimeStr = new Date(order.createdAt).toLocaleTimeString("en-BD", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/orders")} testID="btn-back">
          <Feather name="arrow-left" size={20} color="#1A1A1A" />
        </Pressable>
        <View style={s.headerCenter}>
          <View style={s.headerTitleRow}>
            <Text style={s.headerTitle}>Order #{order.id}</Text>
            <Pressable
              style={[s.statusPill, { backgroundColor: badge.bg }]}
              onPress={() => setShowTimeline(true)}
            >
              <Text style={[s.statusPillText, { color: badge.color }]}>
                {order.status.replace(/_/g, " ")}
              </Text>
            </Pressable>
          </View>
          <Text style={s.headerSub}>{orderDateStr} · {orderTimeStr}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Step Progress ── */}
        {!isCancelled && (
          <View style={s.stepperCard}>
            <StepProgress currentStatus={order.status} events={events} color={THEME} />
          </View>
        )}

        {/* ── Status Banner ── */}
        {isActive && (
          <View style={[s.banner, { backgroundColor: THEME + "18", borderColor: THEME + "44" }]}>
            <MaterialIcons name="location-on" size={18} color={THEME} />
            <Text style={[s.bannerText, { color: THEME }]}>
              Your order is on its way. We'll notify you when it's out for delivery.
            </Text>
          </View>
        )}
        {isCancelled && (
          <View style={[s.banner, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
            <MaterialIcons name="cancel" size={18} color="#EF4444" />
            <Text style={[s.bannerText, { color: "#DC2626" }]}>
              This order has been {order.status}. Contact support if you need help.
            </Text>
          </View>
        )}

        <View style={s.body}>
          {/* ── Items + Address 2-col grid ── */}
          <View style={s.gridRow}>
            {/* Items */}
            <View style={[s.card, s.gridHalf]}>
              <View style={s.cardHeader}>
                <View style={[s.iconBox, { backgroundColor: "#EEF2FF" }]}>
                  <MaterialIcons name="shopping-bag" size={14} color="#4F46E5" />
                </View>
                <Text style={s.cardTitle}>Items</Text>
              </View>
              {order.items.map((item, idx) => (
                <View key={item.id}>
                  {idx > 0 && <View style={s.divider} />}
                  <View style={s.itemRow}>
                    {item.thumbnailUrl
                      ? <Image source={{ uri: item.thumbnailUrl }} style={s.itemThumb} resizeMode="cover" />
                      : <View style={[s.itemThumb, s.itemThumbEmpty]}><Feather name="image" size={16} color="#CCC" /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName} numberOfLines={2}>{item.productName}</Text>
                      {item.variantLabel ? <Text style={s.itemVariant}>{item.variantLabel}</Text> : null}
                      <Text style={s.itemQty}>Qty: {item.quantity}</Text>
                    </View>
                    <Text style={s.itemPrice}>৳{Number(item.price).toLocaleString()}</Text>
                  </View>
                  {order.status === "delivered" && !item.hasReview && (
                    <Pressable style={s.reviewBtn} onPress={() => setReviewItem({ productId: item.productId, orderItemId: item.id })}>
                      <Feather name="star" size={11} color={PINK} />
                      <Text style={s.reviewBtnText}>Review</Text>
                    </Pressable>
                  )}
                  {order.status === "delivered" && item.hasReview && (
                    <View style={s.reviewedBadge}>
                      <Feather name="check-circle" size={11} color="#16A34A" />
                      <Text style={s.reviewedText}>Reviewed</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Address / Store */}
            {order.deliveryMethod === "home_delivery" && order.address ? (
              <View style={[s.card, s.gridHalf]}>
                <View style={s.cardHeader}>
                  <View style={[s.iconBox, { backgroundColor: "#F0FDF4" }]}>
                    <MaterialIcons name="location-on" size={14} color="#16A34A" />
                  </View>
                  <Text style={s.cardTitle}>Delivery Address</Text>
                </View>
                <Text style={s.addressName}>{order.address.fullName}</Text>
                <Text style={s.addressLine}>{order.address.phone}</Text>
                <Text style={s.addressLine}>
                  {[order.address.addressLine, order.address.area, order.address.district].filter(Boolean).join(", ")}
                </Text>
              </View>
            ) : order.deliveryMethod === "store_pickup" && order.storeName ? (
              <View style={[s.card, s.gridHalf]}>
                <View style={s.cardHeader}>
                  <View style={[s.iconBox, { backgroundColor: "#F0FDF4" }]}>
                    <MaterialIcons name="store" size={14} color="#16A34A" />
                  </View>
                  <Text style={s.cardTitle}>Pickup Store</Text>
                </View>
                <Text style={s.addressLine}>{order.storeName}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Courier Service Card ── */}
          {order.deliveryMethod === "home_delivery" && (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.iconBox, { backgroundColor: THEME + "22" }]}>
                  <MaterialIcons name="local-shipping" size={14} color={THEME} />
                </View>
                <Text style={s.cardTitle}>Courier Service</Text>
                {liveStatus && (
                  <View style={s.liveStatusPill}>
                    <View style={s.liveDot} />
                    <Text style={s.liveStatusText}>{liveStatus}</Text>
                  </View>
                )}
              </View>
              <View style={s.courierInfoBox}>
                <View style={s.courierCol}>
                  <Text style={s.courierLabel}>Courier Partner</Text>
                  <Text style={s.courierValue}>
                    {courierName
                      ? courierName.charAt(0).toUpperCase() + courierName.slice(1)
                      : "Not assigned"}
                  </Text>
                </View>
                <View style={s.courierDivV} />
                <View style={s.courierCol}>
                  <Text style={s.courierLabel}>Tracking ID</Text>
                  {trackingId ? (
                    <Pressable onPress={() => handleCopyTracking(trackingId)} style={s.trackingIdBtn}>
                      <Text style={[s.courierValue, { color: PURPLE }]} numberOfLines={1}>
                        {trackingId.length > 12 ? trackingId.slice(0, 12) + "…" : trackingId}
                      </Text>
                      <MaterialIcons name="content-copy" size={11} color={PURPLE} />
                    </Pressable>
                  ) : (
                    <Text style={s.courierValue}>Pending</Text>
                  )}
                </View>
                <View style={s.courierDivV} />
                <View style={s.courierCol}>
                  <Text style={s.courierLabel}>Est. Delivery</Text>
                  <Text style={s.courierValue}>2–4 Days</Text>
                  <View style={s.estBadge}><Text style={s.estBadgeText}>Standard</Text></View>
                </View>
              </View>

              {/* Live courier status detail */}
              {liveTracking && (liveTracking.steadfast || liveTracking.carrybee) && (
                <View style={s.liveTrackCard}>
                  <MaterialIcons name="sensors" size={14} color="#059669" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.liveTrackTitle}>Live Delivery Status</Text>
                    {liveTracking.steadfast?.delivery_status && (
                      <Text style={s.liveTrackLine}>
                        Steadfast: <Text style={s.liveTrackBold}>{liveTracking.steadfast.delivery_status}</Text>
                      </Text>
                    )}
                    {liveTracking.steadfast?.note && (
                      <Text style={s.liveTrackNote}>{liveTracking.steadfast.note}</Text>
                    )}
                    {liveTracking.carrybee?.transferStatus && (
                      <Text style={s.liveTrackLine}>
                        Carrybee: <Text style={s.liveTrackBold}>{liveTracking.carrybee.transferStatus}</Text>
                      </Text>
                    )}
                    {liveTracking.carrybee?.currentLocation && (
                      <Text style={s.liveTrackNote}>📍 {liveTracking.carrybee.currentLocation}</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Action buttons — only when courier is assigned */}
              {hasCourier && (
                <View style={s.courierBtns}>
                  <Pressable
                    style={[s.courierBtn, { borderColor: THEME }]}
                    onPress={() => {
                      showAlert("Contact Courier", `To contact ${courierName ?? "the courier"}, please call their support or use the tracking ID: ${trackingId ?? "N/A"}.`);
                    }}
                  >
                    <Feather name="phone" size={13} color={THEME} />
                    <Text style={[s.courierBtnText, { color: THEME }]}>Contact Courier</Text>
                  </Pressable>
                  <Pressable
                    style={[s.courierBtn, !trackUrl && s.courierBtnDisabled, trackUrl && { borderColor: THEME }]}
                    onPress={async () => {
                      if (trackUrl) await Linking.openURL(trackUrl);
                    }}
                    disabled={!trackUrl}
                  >
                    <MaterialIcons name="open-in-new" size={13} color={trackUrl ? THEME : "#CCC"} />
                    <Text style={[s.courierBtnText, { color: trackUrl ? THEME : "#CCC" }]}>Track Order</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* ── Payment Information ── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBox, { backgroundColor: "#FFF0F6" }]}>
                <MaterialIcons name="payment" size={14} color="#E91E63" />
              </View>
              <Text style={s.cardTitle}>Payment Information</Text>
            </View>
            <View style={s.payRow}>
              {/* Left: stacked label/value rows */}
              <View style={{ flex: 1, gap: 10 }}>
                <View style={s.payInfoRow}>
                  <Text style={s.payInfoLabel}>Method</Text>
                  <Text style={s.payInfoValue} numberOfLines={2}>{PAY_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</Text>
                </View>
                <View style={s.payInfoRow}>
                  <Text style={s.payInfoLabel}>Status</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, justifyContent: "flex-end" }}>
                    <MaterialIcons
                      name={order.paymentStatus === "paid" ? "check-circle" : "schedule"}
                      size={14}
                      color={payStatusColor}
                    />
                    <Text style={[s.payInfoValue, { color: payStatusColor, fontFamily: "Inter_600SemiBold", flexShrink: 1 }]}>
                      {payStatusLabel}
                    </Text>
                  </View>
                </View>
                {!!order.transactionId && (
                  <View style={s.payInfoRow}>
                    <Text style={s.payInfoLabel}>Transaction ID</Text>
                    <Text style={[s.payInfoValue, { flexShrink: 1 }]} numberOfLines={3}>{order.transactionId}</Text>
                  </View>
                )}
                {!!order.senderNumber && (
                  <View style={s.payInfoRow}>
                    <Text style={s.payInfoLabel}>Sender Number</Text>
                    <Text style={[s.payInfoValue, { flexShrink: 1 }]} numberOfLines={2}>{order.senderNumber}</Text>
                  </View>
                )}
              </View>
              {/* Right: logo + Paid + amount */}
              <View style={s.payRightPanel}>
                <PaymentMethodLogo method={order.paymentMethod} logoUrl={payLogoUrl} />
                <Text style={s.payRightLabel}>Paid</Text>
                <Text style={[s.payRightAmount, { color: methodColor }]}>
                  ৳{Number(order.amountPaid).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Order Summary ── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBox, { backgroundColor: "#FFFBEB" }]}>
                <MaterialIcons name="receipt-long" size={14} color="#D97706" />
              </View>
              <Text style={s.cardTitle}>Order Summary</Text>
            </View>

            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Subtotal</Text>
              <Text style={s.summaryValue}>৳{Number(order.subtotal).toLocaleString()}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Shipping</Text>
              <Text style={s.summaryValue}>৳{Number(order.shippingFee).toLocaleString()}</Text>
            </View>
            {Number(order.discount) > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</Text>
                <Text style={[s.summaryValue, { color: "#16A34A" }]}>-৳{Number(order.discount).toLocaleString()}</Text>
              </View>
            )}
            {Number(order.coinsUsed) > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Coins Used</Text>
                <Text style={[s.summaryValue, { color: "#F59E0B" }]}>-{order.coinsUsed} coins</Text>
              </View>
            )}
            <View style={s.divider} />
            <View style={s.summaryRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValue}>৳{Number(order.total).toLocaleString()}</Text>
            </View>
            {order.payDeliveryCharge && Number(order.amountPaid) > 0 && (
              <>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Paid Now</Text>
                  <Text style={[s.summaryValue, { color: "#16A34A" }]}>-৳{Number(order.amountPaid).toLocaleString()}</Text>
                </View>
                {order.status === "delivered" ? (
                  <View style={[s.summaryRow, { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#F0FDF4", borderRadius: 10, marginTop: 2 }]}>
                    <Text style={[s.dueLabel, { color: "#16A34A" }]}>Collected on Delivery</Text>
                    <Text style={[s.dueValue, { color: "#16A34A" }]}>৳{Number(order.amountDue).toLocaleString()}</Text>
                  </View>
                ) : (
                  <View style={[s.summaryRow, s.dueRow]}>
                    <Text style={s.dueLabel}>Due on Delivery</Text>
                    <Text style={s.dueValue}>৳{Number(order.amountDue).toLocaleString()}</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── Notes ── */}
          {!!order.notes && (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.iconBox, { backgroundColor: "#F0FDF4" }]}>
                  <Feather name="file-text" size={13} color="#16A34A" />
                </View>
                <Text style={s.cardTitle}>Notes</Text>
              </View>
              <Text style={s.notesText}>{order.notes}</Text>
            </View>
          )}

          {/* ── Order Timeline ── */}
          {events.length > 0 && (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.iconBox, { backgroundColor: "#EEF2FF" }]}>
                  <MaterialIcons name="timeline" size={14} color="#4F46E5" />
                </View>
                <Text style={s.cardTitle}>Order Timeline</Text>
              </View>
              {events.map((event: any, idx: number) => {
                const isLast = idx === events.length - 1;
                return (
                  <View key={event.id} style={s.timelineRow}>
                    <View style={s.timelineDotCol}>
                      <View style={[s.timelineDot, isLast && s.timelineDotActive]} />
                      {!isLast && <View style={s.timelineLine} />}
                    </View>
                    <View style={s.timelineContent}>
                      <Text style={s.timelineStatus}>{event.status.replace(/_/g, " ")}</Text>
                      <Text style={s.timelineDate}>
                        {new Date(event.timestamp).toLocaleDateString("en-BD", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Footer: Ordered on + Cancel ── */}
          <View style={s.footerRow}>
            <View style={[s.footerDateBox, { backgroundColor: THEME + "18" }]}>
              <MaterialIcons name="calendar-today" size={16} color={THEME} />
              <View>
                <Text style={s.footerDateLabel}>Ordered on</Text>
                <Text style={s.footerDateValue}>{orderDateStr}</Text>
                <Text style={s.footerDateValue}>{orderTimeStr}</Text>
              </View>
            </View>
            {canCancel && (
              <Pressable
                style={[s.cancelBtn, cancelling && { opacity: 0.5 }]}
                onPress={handleCancelOrder}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color="#EF4444" />
                  : <>
                      <MaterialIcons name="cancel" size={16} color="#EF4444" />
                      <Text style={s.cancelBtnText}>Cancel Order</Text>
                    </>}
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Write a Review Sticky Footer ── */}
      {order.status === "delivered" && order.items.some((item: any) => !item.hasReview) && (
        <View style={s.reviewFooter}>
          <Pressable
            style={s.reviewFooterBtn}
            onPress={() => {
              const firstUnreviewed = order.items.find((item: any) => !item.hasReview);
              if (firstUnreviewed) {
                setReviewItem({ productId: firstUnreviewed.productId, orderItemId: firstUnreviewed.id });
              }
            }}
          >
            <Feather name="star" size={16} color="#fff" />
            <Text style={s.reviewFooterBtnText}>Write a Review</Text>
          </Pressable>
        </View>
      )}

      {/* ── Pay Now Footer ── */}
      {isUnpaid && isMfsMethod && (
        <View style={s.payNowFooter}>
          <Pressable
            style={[s.payNowBtn, { backgroundColor: THEME }]}
            onPress={() => {
              const payableAmount = order.payDeliveryCharge ? Number(order.shippingFee) : Number(order.total);
              router.push({
                pathname: "/order/payment-instruction",
                params: {
                  orderId: String(order.id), method: String(order.paymentMethod).toLowerCase(),
                  payableAmount: String(payableAmount), payDeliveryCharge: order.payDeliveryCharge ? "1" : "0",
                  deliveryFee: String(Number(order.shippingFee)),
                  productTotal: String(Math.max(0, Number(order.subtotal) - Number(order.discount))),
                },
              } as any);
            }}
          >
            <Feather name="credit-card" size={18} color="#fff" />
            <Text style={s.payNowBtnText}>Pay Now</Text>
          </Pressable>
        </View>
      )}

      {/* ── Review Modal ── */}
      {reviewItem && (
        <WriteReviewModal
          visible={!!reviewItem}
          productId={reviewItem.productId}
          orderItemId={reviewItem.orderItemId}
          onClose={() => setReviewItem(null)}
          onSuccess={handleReviewSuccess}
        />
      )}

      {/* ── Timeline Modal ── */}
      <TimelineModal
        visible={showTimeline}
        events={events}
        onClose={() => setShowTimeline(false)}
      />

      {/* ── Copy Toast ── */}
      <CopyToast visible={copiedVisible} message={copiedMsg} />
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#F5F7FA" },
  center:          { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#F5F7FA" },
  loadingText:     { marginTop: 12, fontSize: 14, color: "#888", fontFamily: "Inter_400Regular" },
  errorTitle:      { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1A1A1A", marginTop: 16 },
  errorSub:        { fontSize: 13, color: "#888", marginTop: 6, marginBottom: 20 },
  backLinkBtn:     { backgroundColor: PURPLE, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  backLinkText:    { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEEEEE", gap: 10 },
  backBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" },
  headerCenter:    { flex: 1 },
  headerTitleRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:     { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  statusPill:      { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusPillText:  { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  headerSub:       { fontSize: 12, color: "#888", fontFamily: "Inter_400Regular", marginTop: 2 },

  stepperCard:     { backgroundColor: "#fff", marginHorizontal: 0, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },

  banner:          { flexDirection: "row", alignItems: "flex-start", gap: 10, marginHorizontal: 12, marginTop: 12, padding: 12, backgroundColor: "#F3EEFF", borderRadius: 12, borderWidth: 1, borderColor: "#DDD6FE" },
  bannerText:      { flex: 1, fontSize: 13, color: "#5B21B6", fontFamily: "Inter_500Medium", lineHeight: 18 },

  body:            { padding: 12, gap: 12 },

  card:            { backgroundColor: "#fff", borderRadius: 16, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle:       { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  iconBox:         { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  divider:         { height: 1, backgroundColor: "#F0F0F0", marginVertical: 10 },

  gridRow:         { flexDirection: "row", gap: 10 },
  gridHalf:        { flex: 1 },

  itemRow:         { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 4 },
  itemThumb:       { width: 54, height: 54, borderRadius: 8, overflow: "hidden" },
  itemThumbEmpty:  { backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" },
  itemName:        { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1A1A1A", lineHeight: 16 },
  itemVariant:     { fontSize: 11, color: "#888", fontFamily: "Inter_400Regular", marginTop: 2 },
  itemQty:         { fontSize: 11, color: "#888", fontFamily: "Inter_400Regular", marginTop: 2 },
  itemPrice:       { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  reviewBtn:       { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: PINK + "55", backgroundColor: PINK + "0D" },
  reviewBtnText:   { fontSize: 11, color: PINK, fontFamily: "Inter_600SemiBold" },
  reviewedBadge:   { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  reviewedText:    { fontSize: 11, color: "#16A34A", fontFamily: "Inter_500Medium" },

  addressName:     { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1A1A1A", marginBottom: 2 },
  addressLine:     { fontSize: 12, color: "#555", fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },

  courierInfoBox:  { flexDirection: "row", backgroundColor: "#F9F8FF", borderRadius: 12, borderWidth: 1, borderColor: "#EDE9FE", padding: 12, marginBottom: 12, alignItems: "flex-start" },
  courierCol:      { flex: 1, alignItems: "center" },
  courierDivV:     { width: 1, backgroundColor: "#EDE9FE", alignSelf: "stretch", marginHorizontal: 4 },
  courierLabel:    { fontSize: 10, color: "#9CA3AF", fontFamily: "Inter_500Medium", marginBottom: 5, textAlign: "center" },
  courierValue:    { fontSize: 12, color: "#1A1A1A", fontFamily: "Inter_700Bold", textAlign: "center" },
  estBadge:        { backgroundColor: "#EEF2FF", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  estBadgeText:    { fontSize: 9, color: PURPLE, fontFamily: "Inter_600SemiBold" },
  liveStatusPill:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: "auto" },
  liveDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: "#059669" },
  liveStatusText:  { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#059669", textTransform: "capitalize" },
  trackingIdBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  liveTrackCard:   { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#F0FDF4", borderRadius: 10, borderWidth: 1, borderColor: "#A7F3D0", padding: 10, marginBottom: 12 },
  liveTrackTitle:  { fontSize: 12, fontFamily: "Inter_700Bold", color: "#065F46", marginBottom: 4 },
  liveTrackLine:   { fontSize: 12, color: "#374151", fontFamily: "Inter_400Regular", lineHeight: 18 },
  liveTrackBold:   { fontFamily: "Inter_700Bold", color: "#065F46" },
  liveTrackNote:   { fontSize: 11, color: "#6B7280", fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  courierBtns:     { flexDirection: "row", gap: 10 },
  courierBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: PURPLE },
  courierBtnDisabled: { borderColor: "#E0E0E0", backgroundColor: "#FAFAFA" },
  courierBtnText:  { fontSize: 12, color: PURPLE, fontFamily: "Inter_600SemiBold" },

  payRow:          { flexDirection: "row", gap: 12 },
  payInfoRow:      { flexDirection: "row", justifyContent: "flex-start", alignItems: "flex-start", gap: 20 },
  payInfoLabel:    { fontSize: 12, color: "#888", fontFamily: "Inter_400Regular", flexShrink: 0, paddingTop: 1 },
  payInfoValue:    { fontSize: 12, color: "#1A1A1A", fontFamily: "Inter_500Medium", textAlign: "right", flex: 1 },
  payRightPanel:   { width: 150, borderLeftWidth: 1, borderLeftColor: "#F0F0F0", alignItems: "center", justifyContent: "flex-start",gap: 4, paddingLeft: 10 },
  payRightLabel:   { fontSize: 11, color: "#888", fontFamily: "Inter_400Regular", marginTop: 4 },
  payRightAmount:  { fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" },
  payMethodLogo:   { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  payMethodLogoText: { fontSize: 14, fontFamily: "Inter_700Bold" },

  summaryRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  summaryLabel:    { fontSize: 13, color: "#555", fontFamily: "Inter_400Regular" },
  summaryValue:    { fontSize: 13, color: "#1A1A1A", fontFamily: "Inter_500Medium" },
  totalLabel:      { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  totalValue:      { fontSize: 17, fontFamily: "Inter_700Bold", color: PINK },
  dueRow:          { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#FFFBEB", borderRadius: 10, marginTop: 2 },
  dueLabel:        { fontSize: 13, color: "#D97706", fontFamily: "Inter_600SemiBold" },
  dueValue:        { fontSize: 15, color: "#D97706", fontFamily: "Inter_700Bold" },

  notesText:       { fontSize: 13, color: "#555", fontFamily: "Inter_400Regular", lineHeight: 20 },

  timelineRow:     { flexDirection: "row", gap: 12, minHeight: 44 },
  timelineDotCol:  { alignItems: "center", width: 16 },
  timelineDot:     { width: 12, height: 12, borderRadius: 6, backgroundColor: "#DDD", marginTop: 4 },
  timelineDotActive: { backgroundColor: PURPLE },
  timelineLine:    { flex: 1, width: 2, backgroundColor: "#EEEEEE", marginTop: 4, marginBottom: -4 },
  timelineContent: { flex: 1, paddingBottom: 12 },
  timelineStatus:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1A1A1A", textTransform: "capitalize" },
  timelineDate:    { fontSize: 11, color: "#888", fontFamily: "Inter_400Regular", marginTop: 2 },

  footerRow:       { flexDirection: "row", gap: 10, marginTop: 4 },
  footerDateBox:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F3EEFF", borderRadius: 14, padding: 12 },
  footerDateLabel: { fontSize: 11, color: "#888", fontFamily: "Inter_400Regular" },
  footerDateValue: { fontSize: 12, color: "#1A1A1A", fontFamily: "Inter_600SemiBold" },
  cancelBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FEF2F2", borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: "#FECACA" },
  cancelBtnText:   { color: "#EF4444", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  reviewFooter:       { backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F0F0F0", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
  reviewFooterBtn:    { backgroundColor: PINK, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  reviewFooterBtnText:{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  payNowFooter:    { backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F0F0F0", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
  payNowBtn:       { backgroundColor: PURPLE, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  payNowBtnText:   { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
