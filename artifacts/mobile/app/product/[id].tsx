import { Feather, MaterialIcons } from "@expo/vector-icons";
import {
  useGetProduct,
  useAddToCart,
  useTrackProductView,
  useCreateReview,
  useGetWishlist,
  useAddToWishlist,
  useRemoveFromWishlist,
  useListProducts,
  getGetProductQueryKey,
  getGetCartQueryKey,
  getGetWishlistQueryKey,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import CustomAlert from "@/components/CustomAlert";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";

const { width: SCREEN_W } = Dimensions.get("window");
const PINK = "#E91E63";
const BLUE = "#1565C0";
import { API_BASE_URL } from "@/lib/config";
import { trackViewContent, trackAddToCart } from "@/app/lib/tracking";

const BASE_URL = API_BASE_URL;

const MOBILE_COLOR_MAP: Record<string, string> = {
  red: '#EF4444', blue: '#3B82F6', green: '#22C55E', black: '#111827',
  white: '#F9FAFB', yellow: '#FBBF24', pink: '#EC4899', purple: '#A855F7',
  orange: '#F97316', gray: '#9CA3AF', grey: '#9CA3AF', brown: '#92400E',
  navy: '#1E3A8A', 'navy blue': '#1E3A8A', cyan: '#06B6D4', teal: '#14B8A6',
  beige: '#D4B483', cream: '#FEF3C7', maroon: '#9F1239', olive: '#84CC16',
  silver: '#CBD5E1', gold: '#F59E0B', violet: '#7C3AED',
};
function mobileColorHex(name: string): string {
  return MOBILE_COLOR_MAP[name.toLowerCase()] ?? '#9CA3AF';
}
function isColorLight(hex: string): boolean {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (r*299+g*587+b*114)/1000 > 140;
}

/* ─── Write Review Modal ─────────────────────────────────────────── */
function WriteReviewModal({
  visible,
  productId,
  orderItemId,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  productId: number;
  orderItemId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { token } = useAuth();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const createReview = useCreateReview();

  // Local Alert State for Modal
  const [localAlertVisible, setLocalAlertVisible] = useState(false);
  const [localAlertTitle, setLocalAlertTitle] = useState("");
  const [localAlertMessage, setLocalAlertMessage] = useState("");

  const showLocalAlert = (title: string, message: string) => {
    setLocalAlertTitle(title);
    setLocalAlertMessage(message);
    setLocalAlertVisible(true);
  };

  const reset = () => {
    setStars(0);
    setComment("");
    setPhotos([]);
    setSubmitted(false);
  };

  const pickPhoto = async () => {
    if (photos.length >= 3) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.length) return;
    const uri = result.assets[0].uri;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", { uri, name: "photo.jpg", type: "image/jpeg" } as any);
      const resp = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error ?? `Upload failed (${resp.status})`);
      }
      const data = await resp.json();
      if (data.url) setPhotos(prev => [...prev, data.url]);
    } catch (err: any) {
      showLocalAlert("Upload Failed", err?.message ?? "Could not upload photo. Please check your connection and try again.");
    }
    setUploading(false);
  };

  const handleSubmit = () => {
    if (stars === 0) return;
    createReview.mutate(
      { id: productId, data: { orderItemId, rating: stars, comment: comment.trim() || undefined, images: photos } },
      {
        onSuccess: () => {
          setSubmitted(true);
          setTimeout(() => { reset(); onSuccess(); }, 1800);
        },
      }
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

            {/* Star selector */}
            <Text style={rvStyles.label}>Your Rating *</Text>
            <View style={rvStyles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} onPress={() => setStars(s)} style={rvStyles.starBtn}>
                  <Feather
                    name="star"
                    size={36}
                    color={s <= stars ? "#F59E0B" : "#DDD"}
                  />
                </Pressable>
              ))}
            </View>
            {stars > 0 && (
              <Text style={rvStyles.starLabel}>
                {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][stars]}
              </Text>
            )}

            {/* Comment */}
            <Text style={rvStyles.label}>Your Review</Text>
            <TextInput
              style={rvStyles.textarea}
              placeholder="Share your experience with this product..."
              placeholderTextColor="#aaa"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={rvStyles.charCount}>{comment.length}/500</Text>

            {/* Photo picker */}
            <Text style={rvStyles.label}>Add Photos (Optional)</Text>
            <View style={rvStyles.photosRow}>
              {photos.map((uri, i) => (
                <View key={i} style={rvStyles.photoThumb}>
                  <Image source={{ uri }} style={rvStyles.photoImg} />
                  <Pressable style={rvStyles.removePhoto} onPress={() => setPhotos(p => p.filter((_, j) => j !== i))}>
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
              onPress={handleSubmit}
              disabled={stars === 0 || createReview.isPending}
            >
              {createReview.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={rvStyles.submitBtnText}>Submit Review</Text>}
            </Pressable>
          </>
        )}
      </KeyboardAvoidingView>
      <CustomAlert
        visible={localAlertVisible}
        title={localAlertTitle}
        message={localAlertMessage}
        onDismiss={() => setLocalAlertVisible(false)}
      />
    </Modal>
  );
}

const rvStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  handle: { width: 40, height: 4, backgroundColor: "#E0E0E0", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#555", marginBottom: 8, marginTop: 14 },
  starsRow: { flexDirection: "row", gap: 6, justifyContent: "center", marginVertical: 4 },
  starBtn: { padding: 4 },
  starLabel: { textAlign: "center", fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#F59E0B", marginBottom: 4 },
  textarea: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#333", minHeight: 90, backgroundColor: "#FAFAFA" },
  charCount: { fontSize: 11, color: "#aaa", textAlign: "right", marginTop: 4 },
  photosRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  photoThumb: { width: 72, height: 72, borderRadius: 8, overflow: "hidden", position: "relative" },
  photoImg: { width: "100%", height: "100%" },
  removePhoto: { position: "absolute", top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  addPhoto: { width: 72, height: 72, borderRadius: 8, borderWidth: 1.5, borderColor: "#E0E0E0", borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#FAFAFA" },
  addPhotoText: { fontSize: 10, color: "#999" },
  submitBtn: { marginTop: 18, backgroundColor: PINK, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  submitBtnDisabled: { backgroundColor: "#ccc" },
  submitBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  successBox: { alignItems: "center", paddingVertical: 40, gap: 10 },
  successTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  successSub: { fontSize: 13, color: "#888" },
});

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Feather
          key={s}
          name="star"
          size={size}
          color={s <= Math.round(rating) ? "#F59E0B" : "#DDD"}
        />
      ))}
    </View>
  );
}

function ReviewCard({ review }: { review: any }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatar}>
          <Text style={styles.reviewAvatarText}>
            {review.userName?.charAt(0)?.toUpperCase() ?? "U"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewName}>{review.userName}</Text>
          <Stars rating={review.rating} size={11} />
        </View>
        <Text style={styles.reviewDate}>
          {new Date(review.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </Text>
      </View>
      {review.comment ? (
        <Text style={styles.reviewComment}>{review.comment}</Text>
      ) : null}
      {review.images?.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 8 }}
          contentContainerStyle={{ gap: 6 }}
        >
          {review.images.map((img: string, i: number) => (
            <Image
              key={i}
              source={{ uri: img }}
              style={styles.reviewImg}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { showAlert } = useAlert();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [imgIndex, setImgIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});
  const [addedState, setAddedState] = useState<"idle" | "adding" | "added">(
    "idle"
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [canReview, setCanReview] = useState<{ eligible: boolean; orderItemId: number | null }>({ eligible: false, orderItemId: null });
  const imgScrollRef = useRef<ScrollView>(null);

  // Price bump animation
  const priceScale = useRef(new Animated.Value(1)).current;
  const priceColor = useRef(new Animated.Value(0)).current;

  const productId = parseInt(id ?? "0");
  const { data: product, isLoading } = useGetProduct(productId);
  const { data: relatedData } = useListProducts(
    { categoryId: (product as any)?.categoryId, limit: 8 },
    { query: { enabled: !!(product as any)?.categoryId, queryKey: getListProductsQueryKey({ categoryId: (product as any)?.categoryId, limit: 8 }) } }
  );
  const relatedProducts = (relatedData?.products ?? []).filter((p: any) => p.id !== productId).slice(0, 6);

  const [subProducts, setSubProducts] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (!productId) return;
    fetch(`${API_BASE_URL}/api/products/${productId}/sub-products`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSubProducts(data); })
      .catch((e) => console.warn("[SubProducts]", e?.message));
  }, [productId, token]);

  const [fbtProducts, setFbtProducts] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (!productId) return;
    fetch(`${API_BASE_URL}/api/products/${productId}/frequently-bought-together?limit=6`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setFbtProducts(data); })
      .catch((e) => console.warn("[FBT]", e?.message));
  }, [productId]);
  const addToCart = useAddToCart();
  const trackView = useTrackProductView();
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();
  const { data: wishlistData } = useGetWishlist({
    query: { enabled: !!token, queryKey: getGetWishlistQueryKey() },
  });
  const wishlistItems = Array.isArray(wishlistData) ? wishlistData : [];
  const isWishlisted = wishlistItems.some((w: any) => w.productId === productId);

  const toggleWishlist = () => {
    if (!token) { router.push("/auth/login" as any); return; }
    if (isWishlisted) {
      removeFromWishlist.mutate({ productId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() }),
      });
    } else {
      addToWishlist.mutate({ productId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() }),
      });
    }
  };

  // Guard against double-fire in Strict Mode and on re-mounts.
  const viewFired = useRef(false);
  useEffect(() => {
    if (product && token) trackView.mutate({ id: productId });
    if (product && !viewFired.current) {
      viewFired.current = true;
      trackViewContent({
        id: productId,
        name: (product as any).name ?? "",
        price: Number((product as any).price) || 0,
        category: (product as any).category ?? null,
      });
    }
  }, [product?.id]); // eslint-disable-line

  useEffect(() => {
    if (!token || !productId) return;
    fetch(`${BASE_URL}/api/products/${productId}/can-review`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setCanReview(d))
      .catch((e) => console.warn("[CanReview]", e?.message));
  }, [productId, token]);

  const images: string[] = product
    ? [product.thumbnailUrl ?? "", ...(product.images ?? [])].filter(Boolean)
    : [];

  const reviews = (product as any)?.reviews ?? [];

  const variantGroups: Record<string, any[]> = {};
  ((product as any)?.variants ?? []).forEach((v: any) => {
    if (!variantGroups[v.type]) variantGroups[v.type] = [];
    variantGroups[v.type].push(v);
  });

  const basePrice = product ? Number(product.price) : 0;

  // Detect combined Color+Size type
  const combinedTypeKey = Object.keys(variantGroups).find(
    (t: string) => t.toLowerCase().replace(/\s/g, "").includes("+") || t.toLowerCase() === "color_size"
  );
  const combinedVariants: any[] = combinedTypeKey ? (variantGroups[combinedTypeKey] ?? []) : [];

  const splitVariantVal = (val: string | null | undefined): [string, string] | null => {
    if (!val) return null;
    for (const sep of ["+", " / ", " - ", "/", "-"]) {
      const idx = val.indexOf(sep);
      if (idx > 0 && idx < val.length - sep.length) {
        return [val.slice(0, idx).trim(), val.slice(idx + sep.length).trim()];
      }
    }
    return null;
  };

  const colorSizePairs: { variant: any; parts: [string, string] }[] = combinedVariants
    .map((v: any) => ({ variant: v, parts: splitVariantVal(v.value || v.label) }))
    .filter((x: any): x is { variant: any; parts: [string, string] } => x.parts !== null);

  const hasCombined = !!combinedTypeKey && colorSizePairs.length > 0;
  const uniqueColors = [...new Set(colorSizePairs.map((x) => x.parts[0]))] as string[];
  const uniqueSizes = [...new Set(colorSizePairs.map((x) => x.parts[1]))] as string[];

  const matchedVariant: any | null = (selectedColor && selectedSize)
    ? (colorSizePairs.find((x) => x.parts[0] === selectedColor && x.parts[1] === selectedSize)?.variant ?? null)
    : null;

  const individualGroups = Object.entries(variantGroups).filter(([t]) => t !== combinedTypeKey);

  const allVariantsSelected = hasCombined
    ? selectedColor !== null && selectedSize !== null
    : individualGroups.every(([t]) => selectedVariants[t] !== undefined);

  // Price range from all combined variants
  // Bug #4: priceModifier is ABSOLUTE price override (not additive delta) when > 0
  const allVariantPrices = hasCombined
    ? colorSizePairs.map((x) =>
        Number(x.variant.priceModifier) > 0 ? Number(x.variant.priceModifier) : basePrice
      )
    : [];
  const minVariantPrice = allVariantPrices.length > 0 ? Math.min(...allVariantPrices) : basePrice;
  const maxVariantPrice = allVariantPrices.length > 0 ? Math.max(...allVariantPrices) : basePrice;
  const hasPriceRange = hasCombined && minVariantPrice !== maxVariantPrice;

  const effectivePriceEarly = hasCombined
    ? (matchedVariant
        ? (Number(matchedVariant.priceModifier) > 0 ? Number(matchedVariant.priceModifier) : basePrice)
        : minVariantPrice)
    : (() => {
        const mods = individualGroups
          .map(([t]) => {
            const variantId = selectedVariants[t];
            if (!variantId) return 0;
            const v = (variantGroups[t] ?? []).find((vv: any) => vv.id === variantId);
            return Number(v?.priceModifier ?? 0);
          })
          .filter(m => m > 0);
        return mods.length > 0 ? Math.max(...mods) : basePrice;
      })();

  useEffect(() => {
    if (!product) return;
    priceScale.setValue(1);
    priceColor.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(priceScale, { toValue: 1.18, useNativeDriver: true, speed: 40, bounciness: 12 }),
        Animated.spring(priceScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
      ]),
      Animated.sequence([
        Animated.timing(priceColor, { toValue: 1, duration: 150, useNativeDriver: false }),
        Animated.timing(priceColor, { toValue: 0, duration: 400, useNativeDriver: false }),
      ]),
    ]).start();
  }, [effectivePriceEarly]); // eslint-disable-line

  const handleAddToCart = () => {
    if (!token) { router.push("/auth/login" as any); return; }
    if (!allVariantsSelected) {
      if (hasCombined) {
        showAlert("Select Variant", !selectedColor ? "Please select a color first." : "Please select a size.");
      } else {
        const missing = individualGroups.filter(([t]) => selectedVariants[t] === undefined).map(([t]) => t);
        showAlert("Select Variant", `Please select ${missing.join(", ")} to continue.`);
      }
      return;
    }
    const variantIds = hasCombined
      ? (matchedVariant ? [matchedVariant.id] : [])
      : Object.values(selectedVariants);
    setAddedState("adding");
    const callAdd = async () => {
      const resp = await fetch(`${API_BASE_URL}/api/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, quantity: qty, variantIds: variantIds.length > 0 ? variantIds : undefined }),
      });
      if (!resp.ok) throw new Error("Failed");
    };
    callAdd()
      .then(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        setAddedState("added");
        setTimeout(() => setAddedState("idle"), 2000);
        trackAddToCart({
          id: productId,
          name: (product as any)?.name ?? "",
          price: Number((product as any)?.price) || 0,
          quantity: qty,
        });
      })
      .catch(() => {
        setAddedState("idle");
        showAlert("Error", "Failed to add item to cart. Please try again.");
      });
  };

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: (product as any)?.name ?? "Check out this product",
        message: `Check out this product: ${(product as any)?.name ?? ""}\nhttps://shohure.com/product/${productId}`,
      });
    } catch (err: any) {
      if (err?.name !== "AbortError") console.warn("Product share failed:", err?.message);
    }
  }, [productId, (product as any)?.name]);

  const handleBuyNow = () => {
    if (!token) { router.push("/auth/login" as any); return; }
    if (!allVariantsSelected) {
      if (hasCombined) {
        showAlert("Select Variant", !selectedColor ? "Please select a color first." : "Please select a size.");
      } else {
        const missing = individualGroups.filter(([t]) => selectedVariants[t] === undefined).map(([t]) => t);
        showAlert("Select Variant", `Please select ${missing.join(", ")} to continue.`);
      }
      return;
    }
    const variantIds = hasCombined
      ? (matchedVariant ? [matchedVariant.id] : [])
      : Object.values(selectedVariants);
    const selectedLabel = hasCombined
      ? `${selectedColor} / ${selectedSize}`
      : variantIds.map(vid => {
          for (const [type, opts] of Object.entries(variantGroups)) {
            const found = (opts as any[]).find((o: any) => o.id === vid);
            if (found) return `${type}: ${found.value}`;
          }
          return "";
        }).filter(Boolean).join(", ");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/checkout",
      params: {
        buyNow: "1",
        productId: String(productId),
        qty: String(qty),
        variantIds: variantIds.join(","),
        variantId: variantIds[0] ? String(variantIds[0]) : "",
        productName: (product as any)?.name ?? "",
        price: String(effectivePrice),
        thumbnail: (product as any)?.thumbnailUrl ?? "",
      },
    } as any);
  };

  const onImgScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setImgIndex(idx);
  };

  if (isLoading || !product) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: topPad }]}>
        <View style={styles.loadingSpinner} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const effectivePrice = effectivePriceEarly;
  const savings = product.originalPrice
    ? Number(product.originalPrice) - effectivePrice
    : 0;

  return (
    <View style={styles.container}>
      {/* ── Fixed Product Header ── */}
      <View style={[styles.productHeader, { paddingTop: insets.top }]}>
        <View style={styles.productHeaderRow}>
          <Pressable style={styles.headerIconBtn} onPress={() => router.back()} testID="btn-back">
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <Pressable style={styles.productSearchBar} onPress={() => router.push("/search" as any)}>
            <Feather name="search" size={15} color="#9E9E9E" style={{ marginLeft: 12 }} />
            <Text style={styles.productSearchPlaceholder} numberOfLines={1}>
              Search products, brands...
            </Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={[styles.headerIconBtn, isWishlisted && { backgroundColor: "rgba(233,30,99,0.85)" }]}
              onPress={toggleWishlist}
              testID="btn-wishlist"
            >
              <Feather name="heart" size={18} color="#fff" />
            </Pressable>
            <Pressable style={styles.headerIconBtn} onPress={handleShare} testID="btn-share" accessibilityLabel="Share product">
              <Feather name="share-2" size={16} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.headerIconBtn}
              onPress={() => router.push("/(tabs)/cart" as any)}
              testID="btn-cart-header"
            >
              <Feather name="shopping-cart" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ── Image Carousel ── */}
        <View style={styles.carouselWrap}>
          <ScrollView
            ref={imgScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onImgScroll}
            scrollEventThrottle={16}
            style={{ width: SCREEN_W, height: 340 }}
          >
            {images.length > 0 ? (
              images.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  style={{ width: SCREEN_W, height: 340 }}
                  resizeMode="cover"
                />
              ))
            ) : (
              <View style={[styles.imgPlaceholder, { width: SCREEN_W }]}>
                <Feather name="image" size={52} color="#CCC" />
              </View>
            )}
          </ScrollView>

          {/* Dot indicators */}
          {images.length > 1 && (
            <View style={styles.dotsRow}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === imgIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}

          {/* Discount ribbon */}
          {product.discountPercent ? (
            <View style={styles.discountRibbon}>
              <Text style={styles.discountRibbonText}>
                {product.discountPercent}% OFF
              </Text>
            </View>
          ) : null}
        </View>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <View style={styles.thumbStrip}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
            >
              {images.map((uri, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    imgScrollRef.current?.scrollTo({
                      x: i * SCREEN_W,
                      animated: true,
                    });
                    setImgIndex(i);
                  }}
                >
                  <Image
                    source={{ uri }}
                    style={[
                      styles.thumb,
                      i === imgIndex && styles.thumbActive,
                    ]}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Info Card ── */}
        <View style={styles.infoCard}>
          {product.categoryName && (
            <Text style={styles.categoryLabel}>{product.categoryName}</Text>
          )}
          <Text style={styles.productName}>{product.name}</Text>

          {product.avgRating ? (
            <View style={styles.ratingRow}>
              <Stars rating={product.avgRating} size={14} />
              <Text style={styles.ratingText}>
                {product.avgRating.toFixed(1)}
              </Text>
              <Text style={styles.reviewCountText}>
                ({product.reviewCount} reviews)
              </Text>
              <View style={styles.ratingDot} />
              <Text
                style={[
                  styles.stockText,
                  { color: product.stock > 0 ? "#16A34A" : "#EF4444" },
                ]}
              >
                {product.stock > 0 ? "In Stock" : "Out of Stock"}
              </Text>
            </View>
          ) : null}

          {/* Price block */}
          <View style={styles.priceBlock}>
            <Animated.View style={{ transform: [{ scale: priceScale }] }}>
              <Animated.Text
                style={[
                  styles.mainPrice,
                  {
                    color: priceColor.interpolate({
                      inputRange: [0, 1],
                      outputRange: [PINK, "#FF6F00"],
                    }),
                  },
                ]}
              >
                ৳{effectivePrice.toLocaleString()}
              </Animated.Text>
            </Animated.View>
            {hasPriceRange && !matchedVariant && (
              <Text style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                ৳{minVariantPrice.toLocaleString()} – ৳{maxVariantPrice.toLocaleString()}
              </Text>
            )}
            {product.originalPrice ? (
              <View style={styles.priceMeta}>
                <Text style={styles.slashedPrice}>
                  ৳{Number(product.originalPrice).toLocaleString()}
                </Text>
                <View style={styles.offBadge}>
                  <Text style={styles.offBadgeText}>
                    {product.discountPercent}% OFF
                  </Text>
                </View>
              </View>
            ) : null}
            {savings > 0 && (
              <Text style={styles.savingsText}>
                You save ৳{savings.toLocaleString()}
              </Text>
            )}
          </View>

          {/* Delivery promise row */}
          <View style={styles.deliveryRow}>
            <View style={styles.deliveryItem}>
              <MaterialIcons name="local-shipping" size={16} color={BLUE} />
              <Text style={styles.deliveryText}>
                {product.isFast ? "Delivered Tomorrow" : "Standard Delivery"}
              </Text>
            </View>
            <View style={styles.deliveryDivider} />
            <View style={styles.deliveryItem}>
              <MaterialIcons name="verified" size={16} color={BLUE} />
              <Text style={styles.deliveryText}>100% Authentic</Text>
            </View>
            <View style={styles.deliveryDivider} />
            <View style={styles.deliveryItem}>
              <MaterialIcons name="replay" size={16} color={BLUE} />
              <Text style={styles.deliveryText}>7-day Return</Text>
            </View>
          </View>
        </View>

        {/* ── Variant Selector ── */}
        {(hasCombined || individualGroups.length > 0) && (
          <View style={styles.sectionCard}>
            {hasCombined ? (
              <>
                {/* Step 1: Color swatches */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.variantTypeLabel}>
                    Color{!selectedColor ? <Text style={{ color: '#EF4444' }}> *</Text> : null}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                    {uniqueColors.map((color: string) => {
                      const hex = mobileColorHex(color);
                      const light = isColorLight(hex);
                      const isActive = selectedColor === color;
                      return (
                        <Pressable
                          key={color}
                          onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedColor(color); setSelectedSize(null); }}
                          style={{ alignItems: 'center', gap: 4 }}
                        >
                          <View style={{
                            width: 38, height: 38, borderRadius: 19,
                            backgroundColor: hex,
                            borderWidth: isActive ? 3 : 1.5,
                            borderColor: isActive ? PINK : '#D1D5DB',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            {isActive && <Feather name="check" size={14} color={light ? '#111' : '#fff'} />}
                          </View>
                          <Text style={{ fontSize: 9, color: isActive ? PINK : '#666', fontFamily: 'Inter_500Medium', textAlign: 'center', maxWidth: 44 }} numberOfLines={1}>
                            {color}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Step 2: Size buttons */}
                <View style={{ marginBottom: 4 }}>
                  <Text style={styles.variantTypeLabel}>
                    Size
                    {selectedColor && !selectedSize ? <Text style={{ color: '#EF4444' }}> *</Text> : null}
                    {!selectedColor ? <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' }}> — select color first</Text> : null}
                  </Text>
                  <View style={[styles.variantsRow, { marginTop: 6 }]}>
                    {uniqueSizes.map((size: string) => {
                      const availableForColor = selectedColor
                        ? colorSizePairs.some((x) => x.parts[0] === selectedColor && x.parts[1] === size)
                        : true;
                      const inStockForColor = selectedColor
                        ? colorSizePairs.some((x) => x.parts[0] === selectedColor && x.parts[1] === size && (x.variant.stock ?? 0) > 0)
                        : colorSizePairs.some((x) => x.parts[1] === size && (x.variant.stock ?? 0) > 0);
                      const isActive = selectedSize === size && !!selectedColor;
                      const isDisabled = !selectedColor || !availableForColor || !inStockForColor;
                      return (
                        <Pressable
                          key={size}
                          style={[styles.variantChip, isActive && styles.variantChipActive, isDisabled && styles.variantChipOos]}
                          onPress={() => {
                            if (isDisabled) return;
                            Haptics.selectionAsync().catch(() => {});
                            setSelectedSize(size);
                          }}
                        >
                          <Text style={[styles.variantChipText, isActive && styles.variantChipTextActive, isDisabled && styles.variantChipOosText]}>
                            {size}
                          </Text>
                          {isDisabled && selectedColor && !inStockForColor && availableForColor && (
                            <Text style={styles.variantMod}>OOS</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {matchedVariant && (
                  <Text style={{ fontSize: 11, color: '#16A34A', fontFamily: 'Inter_500Medium', marginTop: 8 }}>
                    ✓ {selectedColor} / {selectedSize}{(matchedVariant.stock ?? 0) > 0 ? `  (${matchedVariant.stock} left)` : ''}
                  </Text>
                )}
                {!allVariantsSelected && (selectedColor || selectedSize) && (
                  <Text style={{ fontSize: 11, color: '#EF4444', fontFamily: 'Inter_400Regular', marginTop: 6 }}>
                    ⚠ Please select {!selectedColor ? 'a color' : 'a size'} to add to cart.
                  </Text>
                )}
              </>
            ) : (
              individualGroups.map(([type, opts]: [string, any[]]) => (
                <View key={type} style={{ marginBottom: 12 }}>
                  <Text style={styles.variantTypeLabel}>
                    {type}{selectedVariants[type] ? "" : " *"}
                  </Text>
                  <View style={styles.variantsRow}>
                    {(opts as any[]).map((v: any) => {
                      const active = selectedVariants[type] === v.id;
                      const outOfStock = (v.stock ?? 0) === 0;
                      return (
                        <Pressable
                          key={v.id}
                          style={[styles.variantChip, active && styles.variantChipActive, outOfStock && styles.variantChipOos]}
                          onPress={() => {
                            if (outOfStock) return;
                            Haptics.selectionAsync().catch(() => {});
                            setSelectedVariants(prev => {
                              if (prev[type] === v.id) { const next = { ...prev }; delete next[type]; return next; }
                              return { ...prev, [type]: v.id };
                            });
                          }}
                          testID={`variant-${v.id}`}
                        >
                          <Text style={[styles.variantChipText, active && styles.variantChipTextActive, outOfStock && styles.variantChipOosText]}>
                            {v.value}
                          </Text>
                          {outOfStock && <Text style={styles.variantMod}>Out of stock</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Description ── */}
        {product.description ? (
          <SectionCard title="Product Details">
            <Text
              style={styles.descText}
              numberOfLines={showFullDesc ? undefined : 4}
            >
              {product.description}
            </Text>
            <Pressable
              onPress={() => setShowFullDesc(!showFullDesc)}
              style={styles.readMoreBtn}
            >
              <Text style={styles.readMoreText}>
                {showFullDesc ? "Show less ▲" : "Read more ▼"}
              </Text>
            </Pressable>
          </SectionCard>
        ) : null}

        {/* ── Specifications ── */}
        {product.specifications &&
        Object.keys(product.specifications as object).length > 0 ? (
          <SectionCard title="Specifications">
            {Object.entries(
              product.specifications as Record<string, string>
            ).map(([k, v], i) => (
              <View
                key={k}
                style={[styles.specRow, i % 2 === 0 && styles.specRowAlt]}
              >
                <Text style={styles.specKey}>{k}</Text>
                <Text style={styles.specVal}>{v}</Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {/* ── Sub Products ── */}
        {subProducts.length > 0 && (
          <SectionCard title="Sub Products">
            <Text style={[styles.relatedSubtitle, { marginBottom: 10 }]}>This set includes</Text>
            {subProducts.map((s: any) => (
              <Pressable
                key={s.id}
                style={styles.subProdRow}
                onPress={() => router.push(`/product/${s.subProductId}` as any)}
              >
                {s.thumbnailUrl ? (
                  <Image source={{ uri: s.thumbnailUrl }} style={styles.subProdImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.subProdImage, { backgroundColor: "#f0f0f0", alignItems: "center", justifyContent: "center" }]}>
                    <Feather name="package" size={16} color="#aaa" />
                  </View>
                )}
                <View style={styles.subProdInfo}>
                  <Text style={styles.subProdName} numberOfLines={2}>{s.name}</Text>
                  <Text style={styles.subProdPrice}>৳{Number(s.price).toLocaleString()}</Text>
                </View>
                {s.quantity > 1 && (
                  <View style={styles.subProdQtyBadge}>
                    <Text style={styles.subProdQtyText}>×{s.quantity}</Text>
                  </View>
                )}
                <Feather name="chevron-right" size={16} color="#aaa" />
              </Pressable>
            ))}
          </SectionCard>
        )}

        {/* ── Reviews ── */}
        {reviews.length > 0 && (
          <View style={styles.sectionCard}>
            {/* Summary */}
            <View style={styles.reviewSummary}>
              <View style={styles.reviewScore}>
                <Text style={styles.reviewScoreNum}>
                  {product.avgRating?.toFixed(1) ?? "—"}
                </Text>
                <Stars rating={product.avgRating ?? 0} size={16} />
                <Text style={styles.reviewScoreCount}>
                  {reviews.length} ratings
                </Text>
              </View>
              <View style={styles.ratingBars}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter(
                    (r: any) => Math.round(r.rating) === star
                  ).length;
                  const pct = reviews.length
                    ? (count / reviews.length) * 100
                    : 0;
                  return (
                    <View key={star} style={styles.ratingBarRow}>
                      <Text style={styles.ratingBarLabel}>{star}</Text>
                      <Feather name="star" size={10} color="#F59E0B" />
                      <View style={styles.ratingBarBg}>
                        <View
                          style={[
                            styles.ratingBarFill,
                            { width: `${pct}%` as any },
                          ]}
                        />
                      </View>
                      <Text style={styles.ratingBarCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>
              Customer Reviews
            </Text>
            {reviews.slice(0, 5).map((r: any) => (
              <ReviewCard key={r.id} review={r} />
            ))}
            {reviews.length > 5 && (
              <Pressable style={styles.seeAllReviews}>
                <Text style={styles.seeAllReviewsText}>
                  See all {reviews.length} reviews →
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Frequently Bought Together ── */}
        {fbtProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.relatedHeader}>
              <Text style={styles.sectionTitle}>Frequently Bought Together</Text>
              <Text style={styles.relatedSubtitle}>Customers also buy these</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingBottom: 8 }}
            >
              {fbtProducts.map((p: any, idx: number) => (
                <React.Fragment key={p.id}>
                  <Pressable
                    style={styles.fbtCard}
                    onPress={() => router.push(`/product/${p.id}` as any)}
                  >
                    <Image
                      source={{ uri: p.thumbnailUrl }}
                      style={styles.fbtImg}
                      resizeMode="cover"
                    />
                    {!!p.discountPercent && (
                      <View style={styles.relatedDiscount}>
                        <Text style={styles.relatedDiscountText}>{p.discountPercent}%</Text>
                      </View>
                    )}
                    <View style={styles.fbtInfo}>
                      <Text style={styles.fbtName} numberOfLines={2}>{p.name}</Text>
                      <Text style={styles.fbtPrice}>৳{Number(p.price).toLocaleString()}</Text>
                      <Pressable
                        style={styles.fbtAddBtn}
                        onPress={async (e) => {
                          e.stopPropagation();
                          if (!token) { router.push("/auth/login" as any); return; }
                          try {
                            const resp = await fetch(`${API_BASE_URL}/api/cart/items`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ productId: p.id, quantity: 1 }),
                            });
                            if (!resp.ok) throw new Error("Failed");
                            queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
                            showAlert("Added! 🛒", `${p.name} added to your cart.`);
                          } catch {
                            showAlert("Error", "Failed to add item to cart. Please try again.");
                          }
                        }}
                      >
                        <Feather name="plus" size={12} color="#fff" />
                        <Text style={styles.fbtAddBtnText}>Add</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                  {idx < fbtProducts.length - 1 && (
                    <View style={styles.fbtPlus}>
                      <Text style={styles.fbtPlusText}>+</Text>
                    </View>
                  )}
                </React.Fragment>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── You May Also Like ── */}
        {relatedProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.relatedHeader}>
              <Text style={styles.sectionTitle}>You May Also Like</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingBottom: 8 }}
            >
              {relatedProducts.map((p: any) => (
                <Pressable
                  key={p.id}
                  style={styles.relatedCard}
                  onPress={() => router.push(`/product/${p.id}` as any)}
                >
                  <Image
                    source={{ uri: p.thumbnailUrl }}
                    style={styles.relatedImg}
                    resizeMode="cover"
                  />
                  {!!p.discountPercent && (
                    <View style={styles.relatedDiscount}>
                      <Text style={styles.relatedDiscountText}>{p.discountPercent}%</Text>
                    </View>
                  )}
                  <View style={styles.relatedInfo}>
                    <Text style={styles.relatedName} numberOfLines={2}>{p.name}</Text>
                    <Text style={[styles.relatedPrice, { color: PINK }]}>৳{Number(p.price).toLocaleString()}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Write a Review CTA ── */}
        {token && (
          <View style={styles.writeReviewSection}>
            {canReview.eligible ? (
              <>
                <Text style={styles.writeReviewTitle}>Share Your Experience</Text>
                <Text style={styles.writeReviewSub}>You've purchased this product. Tell others what you think!</Text>
                <Pressable
                  style={styles.writeReviewBtn}
                  onPress={() => setReviewModalVisible(true)}
                >
                  <Feather name="edit-3" size={16} color="#fff" />
                  <Text style={styles.writeReviewBtnText}>Write a Review</Text>
                </Pressable>
              </>
            ) : reviews.length === 0 ? (
              <>
                <Feather name="message-circle" size={28} color="#DDD" />
                <Text style={styles.noReviewTitle}>No reviews yet</Text>
                <Text style={styles.noReviewSub}>Be the first to review after your purchase.</Text>
              </>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Write Review Modal */}
      {canReview.eligible && canReview.orderItemId && (
        <WriteReviewModal
          visible={reviewModalVisible}
          productId={productId}
          orderItemId={canReview.orderItemId}
          onClose={() => setReviewModalVisible(false)}
          onSuccess={() => {
            setReviewModalVisible(false);
            setCanReview({ eligible: false, orderItemId: null });
            queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
          }}
        />
      )}

      {/* ── Bottom Action Bar ── */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 },
        ]}
      >
        <View style={styles.qtyControl}>
          <Pressable
            style={[styles.qtyBtn, qty <= 1 && styles.qtyBtnDisabled]}
            onPress={() => setQty(Math.max(1, qty - 1))}
            testID="btn-qty-minus"
          >
            <Feather name="minus" size={15} color={qty <= 1 ? "#CCC" : "#333"} />
          </Pressable>
          <Text style={styles.qtyValue}>{qty}</Text>
          <Pressable
            style={styles.qtyBtn}
            onPress={() => setQty(qty + 1)}
            testID="btn-qty-plus"
          >
            <Feather name="plus" size={15} color="#333" />
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.cartBtn,
            addedState === "added" && { backgroundColor: "#16A34A" },
            product.stock === 0 && styles.btnDisabled,
          ]}
          onPress={handleAddToCart}
          disabled={product.stock === 0 || addedState === "adding"}
          testID="btn-add-to-cart"
        >
          <Feather
            name={addedState === "added" ? "check" : "shopping-cart"}
            size={17}
            color="#fff"
          />
          <Text style={styles.cartBtnText}>
            {addedState === "adding"
              ? "Adding…"
              : addedState === "added"
              ? "Added!"
              : "Add to Cart"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.buyBtn, product.stock === 0 && styles.btnDisabled]}
          onPress={handleBuyNow}
          disabled={product.stock === 0}
          testID="btn-buy-now"
        >
          <Text style={styles.buyBtnText}>Buy Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },

  productHeader: {
    backgroundColor: BLUE,
    paddingBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 6,
  },
  productHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  productSearchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    height: 40,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
  },
  productSearchPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: "#9E9E9E",
    fontFamily: "Inter_400Regular",
    paddingRight: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#F5F5F5",
  },
  loadingSpinner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: PINK,
    borderTopColor: "transparent",
  },
  loadingText: { fontSize: 14, color: "#999" },

  /* Carousel */
  carouselWrap: { position: "relative", backgroundColor: "#FAFAFA" },
  imgTopOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    zIndex: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  imgPlaceholder: {
    height: 340,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F0F0",
  },
  dotsRow: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { width: 18, backgroundColor: "#fff" },
  discountRibbon: {
    position: "absolute",
    top: 16,
    right: 0,
    backgroundColor: PINK,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  discountRibbonText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },

  /* Thumbnail strip */
  thumbStrip: { backgroundColor: "#fff", paddingVertical: 10 },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#DDD",
  },
  thumbActive: { borderColor: PINK },

  /* Info card */
  infoCard: { backgroundColor: "#fff", marginTop: 8, padding: 16, gap: 10 },
  categoryLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: BLUE,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  productName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
    lineHeight: 25,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#F59E0B" },
  reviewCountText: { fontSize: 12, color: "#888" },
  ratingDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#CCC" },
  stockText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  /* Price */
  priceBlock: { gap: 4 },
  mainPrice: { fontSize: 26, fontFamily: "Inter_700Bold", color: PINK },
  priceMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  slashedPrice: {
    fontSize: 15,
    color: "#AAA",
    textDecorationLine: "line-through",
  },
  offBadge: {
    backgroundColor: "#FFF0F5",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offBadgeText: { color: PINK, fontSize: 11, fontFamily: "Inter_700Bold" },
  savingsText: {
    fontSize: 12,
    color: "#16A34A",
    fontFamily: "Inter_500Medium",
  },

  /* Delivery */
  deliveryRow: {
    flexDirection: "row",
    backgroundColor: "#F0F4FF",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  deliveryItem: { flex: 1, alignItems: "center", gap: 4 },
  deliveryText: {
    fontSize: 10,
    color: "#444",
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  deliveryDivider: { width: 1, backgroundColor: "#D0D9F0" },

  /* Section card */
  sectionCard: { backgroundColor: "#fff", marginTop: 8, padding: 16 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
    marginBottom: 12,
  },

  /* Variants */
  variantTypeLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#333",
    marginBottom: 8,
  },
  variantsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  variantChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#DDD",
    backgroundColor: "#FAFAFA",
  },
  variantChipActive: { borderColor: PINK, backgroundColor: "#FFF0F5" },
  variantChipOos: { borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", opacity: 0.6 },
  variantChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#555",
  },
  variantChipTextActive: { color: PINK, fontFamily: "Inter_700Bold" },
  variantChipOosText: { color: "#AAA", textDecorationLine: "line-through" },
  variantMod: { fontSize: 10, color: "#999", marginTop: 2 },

  /* Description */
  descText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  readMoreBtn: { marginTop: 8 },
  readMoreText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: PINK,
  },

  /* Specs */
  specRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 4 },
  specRowAlt: { backgroundColor: "#F9F9F9", borderRadius: 4 },
  specKey: { flex: 1, fontSize: 13, color: "#888", fontFamily: "Inter_400Regular" },
  specVal: {
    flex: 1,
    fontSize: 13,
    color: "#1A1A1A",
    fontFamily: "Inter_500Medium",
    textAlign: "right",
  },

  /* Reviews */
  reviewSummary: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  reviewScore: { alignItems: "center", gap: 6, width: 72 },
  reviewScoreNum: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
  },
  reviewScoreCount: { fontSize: 11, color: "#888" },
  ratingBars: { flex: 1, gap: 4, justifyContent: "center" },
  ratingBarRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  ratingBarLabel: { fontSize: 11, color: "#555", width: 8 },
  ratingBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: "#EEE",
    borderRadius: 3,
    overflow: "hidden",
  },
  ratingBarFill: {
    height: "100%",
    backgroundColor: "#F59E0B",
    borderRadius: 3,
  },
  ratingBarCount: { fontSize: 10, color: "#888", width: 16, textAlign: "right" },
  reviewCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  reviewName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  reviewDate: { fontSize: 11, color: "#AAA" },
  reviewComment: { fontSize: 13, color: "#555", lineHeight: 20 },
  reviewImg: { width: 64, height: 64, borderRadius: 6 },
  seeAllReviews: { paddingTop: 12, alignItems: "center" },
  seeAllReviewsText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: PINK,
  },

  /* Bottom bar */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    elevation: 8,
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    overflow: "hidden",
  },
  qtyBtn: {
    width: 34,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9F9F9",
  },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyValue: {
    width: 32,
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
  },
  cartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: BLUE,
    paddingVertical: 13,
    borderRadius: 10,
  },
  cartBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  buyBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PINK,
    paddingVertical: 13,
    borderRadius: 10,
  },
  buyBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  btnDisabled: { opacity: 0.45 },

  /* Related products */
  relatedSection: { backgroundColor: "#fff", marginTop: 8, paddingTop: 14, paddingBottom: 4 },
  relatedHeader: { paddingHorizontal: 14, marginBottom: 10 },
  relatedSubtitle: { fontSize: 12, color: "#888", fontFamily: "Inter_400Regular", marginTop: 2 },

  subProdRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  subProdImage: { width: 48, height: 48, borderRadius: 8 },
  subProdInfo: { flex: 1 },
  subProdName: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#222", lineHeight: 18 },
  subProdPrice: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#E91E63", marginTop: 2 },
  subProdQtyBadge: { backgroundColor: "#F5F5F5", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  subProdQtyText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#333" },
  relatedCard: { width: 130, backgroundColor: "#fff", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "#EEE" },
  relatedImg: { width: 130, height: 120 },
  relatedDiscount: { position: "absolute", top: 6, right: 6, backgroundColor: "#E53935", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  relatedDiscountText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  relatedInfo: { padding: 8 },

  fbtCard: { width: 130, backgroundColor: "#fff", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "#EEE" },
  fbtImg: { width: 130, height: 110 },
  fbtInfo: { padding: 8, gap: 4 },
  fbtName: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#1A1A1A", lineHeight: 15 },
  fbtPrice: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#E91E63" },
  fbtAddBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E91E63", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start", marginTop: 2 },
  fbtAddBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  fbtPlus: { alignSelf: "center", width: 24, height: 24, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  fbtPlusText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#555" },
  relatedName: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#1A1A1A", lineHeight: 16, marginBottom: 4 },
  relatedPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },

  /* Write Review CTA */
  writeReviewSection: {
    backgroundColor: "#fff",
    marginTop: 8,
    marginBottom: 8,
    padding: 20,
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  writeReviewTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  writeReviewSub: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 18 },
  writeReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PINK,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 4,
  },
  writeReviewBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  noReviewTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#666", marginTop: 4 },
  noReviewSub: { fontSize: 12, color: "#aaa", textAlign: "center" },
});