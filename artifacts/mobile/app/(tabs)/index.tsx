import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useNotice } from "../../hooks/useNotice";
import {
  useGetActiveFlashSale,
  useListBanners,
  useListCategories,
  useListProducts,
  useListNotifications,
  getListNotificationsQueryKey,
  useGetWishlist,
  useAddToWishlist,
  useRemoveFromWishlist,
  getGetWishlistQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/contexts/ConfigContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  memo,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_W } = Dimensions.get("window");
const FALLBACK_COLOR = "#1565C0";
const PINK = "#E91E63";
const CARD_OVERLAP = 10; 
const CARD_W = 162;
const CARD_H = 148;
const IMAGE_H = Math.round((SCREEN_W * 11) / 16); 
const BOTTOM_GRADIENT_H = 80; 

interface Banner {
  imageUrl: string;
  dominantColor?: string | null;
  title?: string | null;
}

async function extractColorWeb(url: string, fallback: string): Promise<string> {
  if (Platform.OS !== "web") return fallback;
  return new Promise<string>((resolve) => {
    try {
      const img = new (window as any).Image() as HTMLImageElement;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const W = 40;
          const H = 40;
          const canvas = document.createElement("canvas");
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(fallback); return; }
          const srcY = 0;
          const srcH = img.naturalHeight;
          ctx.drawImage(img, 0, srcY, img.naturalWidth, srcH, 0, 0, W, H);
          const { data } = ctx.getImageData(0, 0, W, H);
          const buckets: Record<string, number> = {};
          let maxC = 0;
          let dominant = fallback;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 120) continue;
            const r = Math.round(data[i] / 16) * 16;
            const g = Math.round(data[i + 1] / 16) * 16;
            const b = Math.round(data[i + 2] / 16) * 16;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < 20 || lum > 235) continue;
            const key = `${r},${g},${b}`;
            buckets[key] = (buckets[key] ?? 0) + 1;
            if (buckets[key] > maxC) { maxC = buckets[key]; dominant = `rgb(${r},${g},${b})`; }
          }
          resolve(dominant);
        } catch { resolve(fallback); }
      };
      img.onerror = () => resolve(fallback);
      img.src = url;
    } catch { resolve(fallback); }
  });
}

type PromoCardData = { id: string; enabled: boolean; emoji: string; imageUrl?: string; title: string; subtitle: string; accentColor: string; bgColor: string };
const DEFAULT_PROMO_CARDS: PromoCardData[] =[
  { id: "cart-win",      enabled: true, emoji: "🏆", title: "Add to Cart & Win", subtitle: "Win up to ৳5000 Voucher", accentColor: "#E91E63", bgColor: "#FFF0F5" },
  { id: "free-delivery", enabled: true, emoji: "🚚", title: "FREE DELIVERY",      subtitle: "On orders above ৳500",   accentColor: "#4CAF50", bgColor: "#F1F8E9" },
  { id: "cartup-picks",  enabled: true, emoji: "⭐", title: "CARTUP PICKS",       subtitle: "Curated for you",        accentColor: "#1565C0", bgColor: "#E3F2FD" },
  { id: "flash-sale",    enabled: true, emoji: "⚡", title: "FLASH SALE",         subtitle: "Limited time deals",     accentColor: "#FF6F00", bgColor: "#FFF8E1" },
];

function FlashSaleCountdown({ endsAt, color }: { endsAt: string; color: string }) {
  const[parts, setParts] = useState({ h: "00", m: "00", s: "00" });
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setParts({ h: "00", m: "00", s: "00" }); return; }
      setParts({
        h: String(Math.floor(diff / 3600000)).padStart(2, "0"),
        m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0"),
        s: String(Math.floor((diff % 60000) / 1000)).padStart(2, "0"),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  },[endsAt]);
  const Seg = ({ v }: { v: string }) => (
    <View style={[cntS.seg, { backgroundColor: color }]}><Text style={cntS.digit}>{v}</Text></View>
  );
  const Sep = () => <Text style={[cntS.sep, { color }]}>:</Text>;
  return (
    <View style={cntS.row}>
      <Seg v={parts.h} /><Sep /><Seg v={parts.m} /><Sep /><Seg v={parts.s} />
    </View>
  );
}
const cntS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 },
  seg: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 3, minWidth: 24, alignItems: "center" },
  digit: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  sep: { fontSize: 12, fontFamily: "Inter_700Bold" },
});

const CARTUP_BULLETS =["Lowest Price", "Delivered Tomorrow", "100% Authentic", "Combo Offers"];
const PromoCard = memo(function PromoCard({ card, flashSale, onPress }: { card: PromoCardData; flashSale?: any; onPress?: () => void }) {
  const isFlash = card.id === "flash-sale";
  const isPicks = card.id === "cartup-picks";
  const isWin   = card.id === "cart-win";
  return (
    <Pressable style={[pS.card, { borderTopColor: card.accentColor }]} onPress={onPress}>
      <View style={[pS.accentStrip, { backgroundColor: card.accentColor }]} />
      {card.imageUrl ? (
        <Image source={{ uri: card.imageUrl }} style={pS.cardImage} resizeMode="contain" />
      ) : (
        <Text style={pS.emoji}>{card.emoji}</Text>
      )}
      <Text style={[pS.title, { color: card.accentColor }]} numberOfLines={2}>{card.title}</Text>
      {isFlash && flashSale ? (
        <><FlashSaleCountdown endsAt={(flashSale as any).endsAt} color={card.accentColor} /><Text style={pS.endsNote}>Ends soon!</Text></>
      ) : isPicks ? (
        <View style={{ marginTop: 4, gap: 2 }}>
          {CARTUP_BULLETS.map(b => <Text key={b} style={pS.bullet} numberOfLines={1}><Text style={{ color: card.accentColor }}>✓ </Text>{b}</Text>)}
        </View>
      ) : isWin ? (
        <><Text style={pS.subtitle}>{card.subtitle}</Text><Text style={pS.tnc}>T&amp;C Apply</Text></>
      ) : (
        <Text style={pS.subtitle} numberOfLines={3}>{card.subtitle}</Text>
      )}
    </Pressable>
  );
});
const pS = StyleSheet.create({
  card: { width: CARD_W, height: CARD_H, backgroundColor: "#fff", borderRadius: 14, padding: 10, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  accentStrip: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  emoji: { fontSize: 22, marginBottom: 3, marginTop: 4 },
  cardImage: { width: 72, height: 72, marginBottom: 4, marginTop: 2, alignSelf: "center" },
  title: { fontSize: 11, fontFamily: "Inter_700Bold", lineHeight: 14 },
  subtitle: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#555", marginTop: 3, lineHeight: 13 },
  tnc: { fontSize: 9, color: "#aaa", fontFamily: "Inter_400Regular", marginTop: 3 },
  bullet: { fontSize: 9.5, fontFamily: "Inter_400Regular", color: "#444", lineHeight: 13 },
  endsNote: { fontSize: 9, color: "#FF6F00", fontFamily: "Inter_600SemiBold", marginTop: 3 },
});

const noticeS = StyleSheet.create({
  wrap: { marginHorizontal: 12, marginTop: 10, marginBottom: 2, backgroundColor: "#FFFBEB", borderRadius: 12, borderWidth: 1, borderColor: "#FDE68A", flexDirection: "row", alignItems: "flex-start", padding: 12, gap: 10, shadowColor: "#F59E0B", shadowOpacity: 0.1, shadowRadius: 4, elevation: 1 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  icon: { fontSize: 16 },
  label: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#B45309", letterSpacing: 1.2, marginBottom: 2 },
  msg: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#92400E", lineHeight: 18 },
});

const mTickerS = StyleSheet.create({
  outer: { marginHorizontal: 12, marginTop: 8, borderRadius: 10, backgroundColor: "#F0185A", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 9, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.35)", flexShrink: 0 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 },
  clip: { flex: 1, overflow: "hidden", height: 36, justifyContent: "center" },
  text: { fontSize: 13, color: "#fff", fontFamily: "Inter_500Medium", paddingLeft: 10 },
});

const MobileAnnouncementTicker = memo(function MobileAnnouncementTicker({ text, speed }: { text: string; speed: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const halfWidthRef = useRef(0);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const segment = `${text}   •   `;
  const fullText = segment.repeat(4);

  const startLoop = useCallback((halfW: number) => {
    loopRef.current?.stop();
    anim.setValue(0);
    loopRef.current = Animated.loop(
      Animated.timing(anim, {
        toValue: -halfW,
        duration: Math.max(speed, 5) * 1000,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    );
    loopRef.current.start();
  }, [anim, speed]);

  useEffect(() => {
    if (halfWidthRef.current > 0) startLoop(halfWidthRef.current);
    return () => loopRef.current?.stop();
  }, [speed, startLoop]);

  return (
    <View style={mTickerS.outer}>
      <View style={mTickerS.row}>
        <View style={mTickerS.badge}>
          <Text style={mTickerS.badgeText}>📢 NOTICE</Text>
        </View>
        <View style={mTickerS.clip}>
          <View style={{ position: "absolute", opacity: 0, top: 0, left: 0 }} pointerEvents="none">
            <Text
              style={mTickerS.text}
              onLayout={e => {
                const w = e.nativeEvent.layout.width;
                if (w > 0 && halfWidthRef.current === 0) {
                  halfWidthRef.current = w / 2;
                  startLoop(w / 2);
                }
              }}
            >
              {fullText}
            </Text>
          </View>
          <Animated.Text style={[mTickerS.text, { transform: [{ translateX: anim }] }]} numberOfLines={1}>
            {fullText}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
});

const PRODUCT_CARD_W = Math.floor((SCREEN_W - 40) / 2);
const ProductCard = memo(function ProductCard({ item, onPress, small, isWishlisted, onToggleWishlist }: {
  item: any; onPress: () => void; small?: boolean; isWishlisted?: boolean; onToggleWishlist?: (id: number) => void;
}) {
  const colors = useColors();
  const w = small ? 140 : PRODUCT_CARD_W;
  return (
    <Pressable style={[styles.productCard, { width: w, backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} testID={`product-card-${item.id}`}>
      <View style={[styles.productImgWrap, { height: small ? 110 : 150 }]}>
        <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {item.isFast && <View style={styles.fastBadge}><Text style={styles.fastText}>FAST</Text></View>}
        {!!item.discountPercent && <View style={styles.discountBadge}><Text style={styles.discountText}>{item.discountPercent}%</Text></View>}
        {onToggleWishlist && (
          <Pressable style={[styles.heartBtn, isWishlisted && styles.heartBtnActive]} onPress={e => { e.stopPropagation?.(); onToggleWishlist(item.id); }} testID={`btn-wish-${item.id}`}>
            <Feather name="heart" size={13} color={isWishlisted ? "#fff" : "#E91E63"} />
          </Pressable>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.price, { color: colors.primary }]}>৳{Number(item.price).toLocaleString()}</Text>
        {item.originalPrice ? <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>৳{Number(item.originalPrice).toLocaleString()}</Text> : null}
      </View>
    </Pressable>
  );
});

const SERVICE_ITEMS =[
  { icon: "local-offer",    label: "Lowest\nPrice" },
  { icon: "flash-on",       label: "Delivered\nTomorrow" },
  { icon: "verified",       label: "100%\nAuthentic" },
  { icon: "card-giftcard",  label: "BOGO &\nCombo" },
  { icon: "local-shipping", label: "Free\nDelivery" },
  { icon: "replay",         label: "Easy\nReturns" },
];
const ServiceBadge = memo(function ServiceBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.serviceBadge}>
      <View style={styles.serviceIconWrap}><MaterialIcons name={icon as any} size={22} color={FALLBACK_COLOR} /></View>
      <Text style={styles.serviceLabel}>{label}</Text>
    </View>
  );
});

interface HeroBannerProps {
  banners: Banner[];
  heroH: number;
  topBarH: number;
  scrollX: Animated.Value;
  animatedBgColor: any;
  bannerColors: string[];
  primaryColor: string;
}

const HeroBanner = memo(function HeroBanner({ banners, heroH, topBarH, scrollX, animatedBgColor, bannerColors, primaryColor }: HeroBannerProps) {
  const { siteName } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const currentIndex = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTouched = useRef(false);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  },[]);

  const startTimer = useCallback(() => {
    stopTimer();
    if (banners.length < 2) return;
    
    timerRef.current = setInterval(() => {
      if (isTouched.current) return;
      const nextIdx = (currentIndex.current + 1) % banners.length;
      scrollRef.current?.scrollTo({ x: nextIdx * SCREEN_W, animated: true });
    }, 4000); 
  }, [banners.length, stopTimer]);

  useEffect(() => {
    startTimer();
    return stopTimer;
  }, [startTimer, stopTimer]);

  const handleTouchStart = useCallback(() => {
    isTouched.current = true;
    stopTimer();
  }, [stopTimer]);

  const handleTouchEnd = useCallback(() => {
    isTouched.current = false;
    startTimer();
  }, [startTimer]);

  const handleMomentumEnd = useCallback((e: any) => {
    isTouched.current = false;
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_W);
    currentIndex.current = idx;
    setActiveIndex(idx);
    startTimer();
  }, [startTimer]);

  if (banners.length === 0) {
    return (
      <View style={{ height: heroH, backgroundColor: FALLBACK_COLOR }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 52 }}>🛍️</Text>
          <Text style={hS.fallbackTitle}>Welcome to {siteName}</Text>
          <Text style={hS.fallbackSub}>Bangladesh's favourite store</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={{ height: heroH, backgroundColor: animatedBgColor }}>
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: false, 
            listener: (e: any) => {
              const x = e.nativeEvent.contentOffset.x;
              const idx = Math.round(x / SCREEN_W);
              if (currentIndex.current !== idx) {
                currentIndex.current = idx;
                setActiveIndex(idx);
              }
            }
          }
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onScrollBeginDrag={handleTouchStart}
        onScrollEndDrag={handleTouchEnd}
        onMomentumScrollBegin={handleTouchStart}
        onMomentumScrollEnd={handleMomentumEnd}
        style={StyleSheet.absoluteFill}
      >
        {banners.map((b: Banner, i: number) => {
          const currentBannerColor = bannerColors[i] || primaryColor;
          return (
            <View key={i} style={{ width: SCREEN_W, height: heroH }}>
              <Image
                source={{ uri: b.imageUrl }}
                style={{ position: "absolute", bottom: 0, width: SCREEN_W, height: IMAGE_H }}
                resizeMode="cover"
              />
              <LinearGradient
                colors={[currentBannerColor, "transparent"]}
                style={{ position: "absolute", top: topBarH - 2, left: 0, right: 0, height: 40, zIndex: 5 } as any}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["transparent", currentBannerColor]}locations={[0.8,1]}
                style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 60, zIndex: 5 } as any}
                pointerEvents="none"
              />
            </View>
          );
        })}
      </Animated.ScrollView>

      {banners.length > 1 && (
        <View style={hS.dots as any}>
          {banners.map((_: Banner, i: number) => (
            <View key={i} style={[hS.dot, i === activeIndex && hS.dotActive]} />
          ))}
        </View>
      )}
    </Animated.View>
  );
});

const hS = StyleSheet.create({
  fallbackTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 8, textShadowColor: "rgba(0,0,0,0.3)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  fallbackSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  dots: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { width: 20, height: 6, borderRadius: 3, backgroundColor: "#fff" },
});

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const[selectedCat, setSelectedCat] = useState<number | null>(null);

  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [bannerColors, setBannerColors] = useState<string[]>([]);

  const { data: categoriesData } = useListCategories();
  const categories = useMemo(() => (Array.isArray(categoriesData) ? categoriesData : []),[categoriesData]);
  const catTabs = useMemo(() =>[{ id: null, name: "All" }, ...categories.slice(0, 7)] as any[], [categories]);

  const { data: productsData } = useListProducts({ categoryId: selectedCat ?? undefined, limit: 20 });
  const products = useMemo(() => productsData?.products ??[],[productsData]);

  const { data: banners } = useListBanners();
  const bannerList = useMemo(() => (Array.isArray(banners) ? banners : []),[banners]);

  const { data: flashSale } = useGetActiveFlashSale();
  const flashProducts = useMemo(() => (flashSale as any)?.products ?? [],[flashSale]);

  const { config: appConfig } = useAppConfig();
  const primaryColor = useMemo(() => appConfig?.primaryColor ?? PINK, [appConfig]);

  const { token } = useAuth();
  const { data: notificationsData } = useListNotifications({
    query: { enabled: !!token, queryKey: getListNotificationsQueryKey() },
  });
  const unreadCount = useMemo(() => {
    if (!Array.isArray(notificationsData)) return 0;
    return notificationsData.filter((n: any) => !n.read).length;
  }, [notificationsData]);

  useEffect(() => {
    if (!bannerList.length) return;
    let isMounted = true;
    const fetchColors = async () => {
      const extractedColors = await Promise.all(
        bannerList.map(async (b) => {
          if ((b as any).dominantColor) return (b as any).dominantColor;
          if (Platform.OS === "web") return await extractColorWeb(b.imageUrl, primaryColor);
          return primaryColor;
        })
      );
      if (isMounted) setBannerColors(extractedColors);
    };
    fetchColors();
    return () => { isMounted = false; };
  },[bannerList, primaryColor]);

  const inputRange = bannerList.length > 1 ? bannerList.map((_, i) => i * SCREEN_W) : [0, 1];
  const singleColor = bannerColors[0] ?? primaryColor;

  // Ensure outputRange always matches inputRange length
  const outputRange = (() => {
    const required = inputRange.length;
    // If we have enough banner colors, slice to required length
    if (bannerColors.length >= required) {
      return bannerColors.slice(0, required);
    }
    // Otherwise, pad with singleColor
    return Array.from({ length: required }, (_, i) => bannerColors[i] ?? singleColor);
  })();

  const animatedBgColor = scrollX.interpolate({
    inputRange,
    outputRange,
    extrapolate: 'clamp',
  });

  const promoCards: PromoCardData[] = useMemo(() => {
    const raw = appConfig?.promoCardsJson;
    if (raw) { try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length > 0) return p as PromoCardData[]; } catch (e) { console.warn("Failed to parse promoCardsJson:", e); } }
    return DEFAULT_PROMO_CARDS;
  }, [appConfig]);
  const visibleCards = useMemo(() => promoCards.filter(c => c.enabled),[promoCards]);

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const { data: wishlistData } = useGetWishlist({ query: { queryKey: getGetWishlistQueryKey() } });
  const wishlistSet = useMemo(() => {
    const items = Array.isArray(wishlistData) ? wishlistData :[];
    return new Set(items.map((w: any) => w.productId));
  },[wishlistData]);
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  const toggleWishlist = useCallback((productId: number) => {
    if (wishlistSet.has(productId)) {
      removeFromWishlist.mutate({ productId }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() }) });
    } else {
      addToWishlist.mutate({ productId }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() }) });
    }
  },[wishlistSet, queryClient]);

  const handleSearch = useCallback(() => {
    if (search.trim()) router.push({ pathname: "/search", params: { q: search } } as any);
    else router.push("/search" as any);
  }, [search]);

  const notice = useNotice();
  const topBarH = insets.top + 112; 
  const heroH = topBarH + IMAGE_H;

  return (
    <View style={[styles.container, { backgroundColor: "#F5F5F5" }]}>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 + 84 : 90 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={1}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1565C0"
            colors={["#1565C0"]}
            progressViewOffset={120}
          />
        }
      >
        
        <View style={{ height: heroH, width: '100%' }} />

        <Animated.View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: heroH,
          transform: [{ translateY: scrollY }],
          zIndex: 0,
        }}>
          <HeroBanner
            banners={bannerList}
            heroH={heroH}
            topBarH={topBarH}
            scrollX={scrollX}
            animatedBgColor={animatedBgColor}
            bannerColors={bannerColors}
            primaryColor={primaryColor}
          />
        </Animated.View>

        <View style={{ backgroundColor: "#F5F5F5", zIndex: 1 }}>
          
          <Animated.View style={{ height: BOTTOM_GRADIENT_H, marginTop: -2, backgroundColor: animatedBgColor }}>
            <LinearGradient
              colors={["transparent", "#F5F5F5"]}
              style={StyleSheet.absoluteFill as any}
              pointerEvents="none"
            />
          </Animated.View>

          {visibleCards.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: -(BOTTOM_GRADIENT_H - CARD_OVERLAP), zIndex: 10, height: CARD_H + 8 }}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8, gap: 10 }}
            >
              {visibleCards.map(card => (
                <PromoCard
                  key={card.id}
                  card={card}
                  flashSale={card.id === "flash-sale" ? flashSale : undefined}
                  onPress={() => router.push(card.id === "flash-sale" ? "/(tabs)/categories" : "/search" as any)}
                />
              ))}
            </ScrollView>
          )}

          {appConfig.webAnnouncementActive !== false && appConfig.webAnnouncementText ? (
            <MobileAnnouncementTicker
              text={appConfig.webAnnouncementText}
              speed={appConfig.webAnnouncementSpeed ?? 60}
            />
          ) : null}

          {notice?.message ? (
            <View style={noticeS.wrap}>
              <View style={noticeS.iconWrap}>
                <Text style={noticeS.icon}>📢</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={noticeS.label}>NOTICE</Text>
                <Text style={noticeS.msg}>{notice.message}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.sectionWhite}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceScroll}>
              {SERVICE_ITEMS.map(s => <ServiceBadge key={s.label} icon={s.icon} label={s.label} />)}
              {categories.slice(0, 4).map((c: any) => (
                <Pressable key={c.id} style={styles.serviceBadge} onPress={() => setSelectedCat(c.id)}>
                  {c.imageUrl
                    ? <Image source={{ uri: c.imageUrl }} style={[styles.serviceIconWrap, { borderRadius: 22 }]} resizeMode="cover" />
                    : <View style={[styles.serviceIconWrap, { backgroundColor: "#EEE" }]}><Text style={{ fontSize: 18 }}>🏷️</Text></View>}
                  <Text style={styles.serviceLabel} numberOfLines={2}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {flashSale ? (
            <View style={styles.flashSection}>
              <View style={styles.flashHeader}>
                <View style={styles.flashTitleRow}>
                  <Text style={styles.flashIcon}>⚡</Text>
                  <Text style={styles.flashTitle}>FLASH SALE</Text>
                </View>
                <FlashSaleCountdown endsAt={(flashSale as any).endsAt} color="#FF6F00" />
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={flashProducts}
                keyExtractor={(item: any) => String(item.id)}
                renderItem={({ item }) => <ProductCard small item={item} onPress={() => router.push(`/product/${item.id}` as any)} />}
                contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
                scrollEnabled
              />
            </View>
          ) : null}

          <View style={styles.productsSection}>
            <View style={styles.productsSectionHeader}>
              <Text style={styles.productsSectionTitle}>
                {selectedCat ? (catTabs.find((c: any) => c.id === selectedCat)?.name ?? "Products") : "Popular Products"}
              </Text>
              <Pressable onPress={() => router.push({ pathname: "/(tabs)/categories", params: selectedCat ? { categoryId: String(selectedCat) } : {} } as any)}>
                <Text style={[styles.seeAll, { color: FALLBACK_COLOR }]}>See all</Text>
              </Pressable>
            </View>
            <View style={styles.productGrid}>
              {products.map((item: any) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onPress={() => router.push(`/product/${item.id}` as any)}
                  isWishlisted={wishlistSet.has(item.id)}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
            </View>
            {!products.length && (
              <View style={styles.emptyState}>
                <Feather name="package" size={40} color="#CCC" />
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            )}
          </View>
          
        </View>
      </Animated.ScrollView>

      <View style={[styles.floatingHeader, { paddingTop: insets.top + 8 } as any]}>
        
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: animatedBgColor, zIndex: -1 }]} />

        <View style={styles.searchRow}>
          <Pressable style={styles.searchBar} onPress={() => router.push("/search" as any)}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search products, brands..."
              placeholderTextColor="#9E9E9E"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              testID="input-search"
              onFocus={() => router.push("/search" as any)}
              editable={false}
              pointerEvents="none"
            />
            <View style={styles.searchMic}><Feather name="mic" size={18} color="#9E9E9E" /></View>
          </Pressable>
          <Pressable style={[styles.searchBtn, { backgroundColor: primaryColor }]} onPress={() => router.push("/search" as any)}>
            <Feather name="search" size={20} color="#fff" />
          </Pressable>
          <Pressable style={styles.scanBtn} onPress={() => router.push("/notifications" as any)}>
            <Feather name="bell" size={22} color="#555" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 99 ? "99+" : String(unreadCount)}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catTabsContent}>
          {catTabs.map((cat: any) => {
            const active = selectedCat === cat.id;
            return (
              <Pressable key={String(cat.id ?? "all")} style={styles.catTab} onPress={() => setSelectedCat(cat.id)} testID={`tab-cat-${cat.id ?? "all"}`}>
                <Text style={[styles.catTabText, active &&[styles.catTabTextActive, { color: "#fff" }]]}>{cat.name}</Text>
                {active && <View style={[styles.catTabUnderline, { backgroundColor: primaryColor }]} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  floatingHeader: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 },
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  searchBar: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: "#E0E0E0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 4,
  },
  searchInput: { flex: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 11, color: "#1A1A1A", fontFamily: "Inter_400Regular" },
  searchMic: { paddingHorizontal: 10, paddingVertical: 11 },
  searchBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  scanBtn: { backgroundColor: "rgba(255,255,255,0.92)", padding: 10, borderRadius: 8, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3, elevation: 2, position: "relative" },
  notifBadge: { position: "absolute", top: 2, right: 2, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#E91E63", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.92)" },
  notifBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold", lineHeight: 11 },
  catTabsContent: { paddingHorizontal: 8 },
  catTab: { paddingHorizontal: 14, paddingVertical: 9, alignItems: "center", position: "relative" },
  catTabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  catTabTextActive: { fontFamily: "Inter_700Bold" },
  catTabUnderline: { position: "absolute", bottom: 0, left: 6, right: 6, height: 2.5, borderRadius: 2 },

  sectionWhite: { backgroundColor: "#fff", marginTop: 8 },
  serviceScroll: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  serviceBadge: { width: 66, alignItems: "center", gap: 5 },
  serviceIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E3F2FD", alignItems: "center", justifyContent: "center" },
  serviceLabel: { fontSize: 10, textAlign: "center", color: "#444", fontFamily: "Inter_400Regular", lineHeight: 13 },
  flashSection: { backgroundColor: "#fff", marginTop: 8 },
  flashHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  flashTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  flashIcon: { fontSize: 18 },
  flashTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FF6F00", letterSpacing: 1 },

  productsSection: { padding: 16 },
  productsSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  productsSectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  productCard: { borderRadius: 12, overflow: "hidden", borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  productImgWrap: { width: "100%", position: "relative", backgroundColor: "#F5F5F5" },
  fastBadge: { position: "absolute", top: 6, left: 6, backgroundColor: "#1565C0", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  fastText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  discountBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "#E91E63", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discountText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  heartBtn: { position: "absolute", bottom: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  heartBtnActive: { backgroundColor: "#E91E63" },
  productInfo: { padding: 10 },
  productName: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16, marginBottom: 4 },
  price: { fontSize: 14, fontFamily: "Inter_700Bold" },
  originalPrice: { fontSize: 11, fontFamily: "Inter_400Regular", textDecorationLine: "line-through", marginTop: 1 },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: "#999", fontSize: 14, fontFamily: "Inter_400Regular" },
});