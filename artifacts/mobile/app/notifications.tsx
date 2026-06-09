import { Feather, MaterialIcons } from "@expo/vector-icons";
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const PINK = "#E91E63";
const BLUE = "#1565C0";

/* ─── Type config ──────────────────────────────────────────────── */
type NType = "order" | "promo" | "system" | "general";

const TYPE_CONFIG: Record<
  NType,
  { icon: string; iconSet: "feather" | "material"; color: string; bg: string; label: string }
> = {
  order: {
    icon: "package",
    iconSet: "feather",
    color: BLUE,
    bg: "#E3F2FD",
    label: "Order",
  },
  promo: {
    icon: "local-offer",
    iconSet: "material",
    color: PINK,
    bg: "#FCE4EC",
    label: "Promo",
  },
  system: {
    icon: "settings",
    iconSet: "feather",
    color: "#FF6F00",
    bg: "#FFF8E1",
    label: "System",
  },
  general: {
    icon: "bell",
    iconSet: "feather",
    color: "#7C3AED",
    bg: "#EDE9FE",
    label: "General",
  },
};

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "order", label: "Orders" },
  { id: "promo", label: "Promos" },
  { id: "system", label: "System" },
  { id: "general", label: "General" },
];

/* ─── Helpers ──────────────────────────────────────────────────── */
function getDateGroup(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return "Older";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString("en-BD", { day: "2-digit", month: "short" });
}

/* ─── Pulsing unread dot ───────────────────────────────────────── */
function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        dot.outer,
        { backgroundColor: color + "33", transform: [{ scale }] },
      ]}
    >
      <View style={[dot.inner, { backgroundColor: color }]} />
    </Animated.View>
  );
}
const dot = StyleSheet.create({
  outer: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  inner: { width: 8, height: 8, borderRadius: 4 },
});

/* ─── Notification row ─────────────────────────────────────────── */
function NotifRow({
  item,
  onPress,
}: {
  item: any;
  onPress: (id: number, type: string) => void;
}) {
  const cfg = TYPE_CONFIG[(item.type as NType) ?? "general"] ?? TYPE_CONFIG.general;
  const slideIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideIn, {
      toValue: 1,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: slideIn,
        transform: [
          {
            translateY: slideIn.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      <Pressable
        style={[
          styles.card,
          !item.read && { borderLeftWidth: 3, borderLeftColor: cfg.color, backgroundColor: "#fff" },
          item.read && styles.cardRead,
        ]}
        onPress={() => onPress(item.id, item.type)}
        testID={`notif-${item.id}`}
        android_ripple={{ color: "#F5F5F5" }}
      >
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
          {cfg.iconSet === "feather" ? (
            <Feather name={cfg.icon as any} size={18} color={cfg.color} />
          ) : (
            <MaterialIcons name={cfg.icon as any} size={18} color={cfg.color} />
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={[styles.typePill, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.typePillText, { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </View>
            <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text
            style={[styles.title, !item.read && styles.titleUnread]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
        </View>

        {/* Unread indicator */}
        {!item.read && (
          <View style={styles.dotWrap}>
            <PulseDot color={cfg.color} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ─── Date group header ────────────────────────────────────────── */
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.groupHeader}>
      <View style={styles.groupLine} />
      <View style={styles.groupLabelWrap}>
        <Text style={styles.groupLabel}>{label}</Text>
        <View style={styles.groupCount}>
          <Text style={styles.groupCountText}>{count}</Text>
        </View>
      </View>
      <View style={styles.groupLine} />
    </View>
  );
}

/* ─── Notification Detail Modal ────────────────────────────────── */
function NotifDetailModal({
  item,
  onClose,
}: {
  item: any | null;
  onClose: () => void;
}) {
  if (!item) return null;
  const cfg = TYPE_CONFIG[(item.type as NType) ?? "general"] ?? TYPE_CONFIG.general;
  return (
    <Modal
      visible={!!item}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={modal.overlay} onPress={onClose}>
        <Pressable style={modal.sheet} onPress={() => {}}>
          {/* Icon header */}
          <View style={[modal.iconCircle, { backgroundColor: cfg.bg }]}>
            {cfg.iconSet === "feather" ? (
              <Feather name={cfg.icon as any} size={28} color={cfg.color} />
            ) : (
              <MaterialIcons name={cfg.icon as any} size={28} color={cfg.color} />
            )}
          </View>

          {/* Type + time */}
          <View style={modal.metaRow}>
            <View style={[modal.typePill, { backgroundColor: cfg.bg }]}>
              <Text style={[modal.typePillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={modal.time}>{formatTime(item.createdAt)}</Text>
          </View>

          {/* Title */}
          <Text style={modal.title}>{item.title}</Text>

          {/* Body */}
          <Text style={modal.body}>{item.body}</Text>

          {/* Close button */}
          <Pressable style={[modal.closeBtn, { backgroundColor: cfg.color }]} onPress={onClose}>
            <Text style={modal.closeBtnText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  typePillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  time: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#BDBDBD" },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
    textAlign: "center",
    lineHeight: 24,
    marginTop: 4,
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#555",
    textAlign: "center",
    lineHeight: 21,
  },
  closeBtn: {
    marginTop: 8,
    width: "100%",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  closeBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
});

/* ─── Main screen ──────────────────────────────────────────────── */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [activeTab, setActiveTab] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [detailItem, setDetailItem] = useState<any | null>(null);

  const { data, refetch, isLoading } = useListNotifications({
    query: { enabled: !!token, queryKey: getListNotificationsQueryKey() },
  });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const all: any[] = Array.isArray(data)
    ? [...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : [];

  const unreadCount = all.filter((n) => !n.read).length;

  /* Filter */
  const filtered =
    activeTab === "all" ? all : all.filter((n) => n.type === activeTab);

  /* Group by date */
  type Section = { group: string; items: any[] };
  const sections: Section[] = [];
  const groupMap: Record<string, any[]> = {};
  for (const n of filtered) {
    const g = getDateGroup(n.createdAt);
    if (!groupMap[g]) groupMap[g] = [];
    groupMap[g].push(n);
  }
  const GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Older"];
  for (const g of GROUP_ORDER) {
    if (groupMap[g]) sections.push({ group: g, items: groupMap[g] });
  }

  /* Flatten for FlatList with section headers */
  type ListItem =
    | { kind: "header"; group: string; count: number }
    | { kind: "notif"; data: any };

  const listData: ListItem[] = [];
  for (const sec of sections) {
    listData.push({ kind: "header", group: sec.group, count: sec.items.length });
    for (const item of sec.items) {
      listData.push({ kind: "notif", data: item });
    }
  }

  /* Handlers */
  const handleNotifPress = (id: number, type: string) => {
    const item = all.find((n) => n.id === id);
    if (item && !item.read) {
      markRead.mutate(
        { id },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) }
      );
    }
    /* Deep link to order if it's an order notification */
    if (type === "order" && item?.body) {
      const match = item.body.match(/#(\d+)/);
      if (match) {
        router.push(`/order/${match[1]}` as any);
        return;
      }
    }
    /* For all other types: open the detail modal */
    if (item) setDetailItem(item);
  };

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  /* Tab counts */
  const tabCounts: Record<string, number> = { all: all.length };
  for (const n of all) {
    tabCounts[n.type] = (tabCounts[n.type] ?? 0) + 1;
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <NotifDetailModal item={detailItem} onClose={() => setDetailItem(null)} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#333" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <Pressable
            style={styles.markAllBtn}
            onPress={handleMarkAll}
            disabled={markAll.isPending}
            testID="btn-mark-all-read"
          >
            <Feather name="check-circle" size={14} color={PINK} />
            <Text style={styles.markAllText}>All read</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* ── Filter tabs ── */}
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {FILTER_TABS.map((tab) => {
            const active = activeTab === tab.id;
            const cnt = tabCounts[tab.id] ?? 0;
            if (tab.id !== "all" && cnt === 0) return null;
            return (
              <Pressable
                key={tab.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {cnt > 0 && (
                  <View
                    style={[
                      styles.tabCount,
                      active && { backgroundColor: PINK },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabCountText,
                        active && { color: "#fff" },
                      ]}
                    >
                      {cnt}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── List ── */}
      {!token ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Feather name="lock" size={36} color="#CCC" />
          </View>
          <Text style={styles.emptyTitle}>Login to see notifications</Text>
          <Pressable
            style={styles.loginBtn}
            onPress={() => router.push("/auth/login" as any)}
          >
            <Text style={styles.loginBtnText}>Login</Text>
          </Pressable>
        </View>
      ) : listData.length === 0 && !isLoading ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Feather name="bell-off" size={36} color="#CCC" />
          </View>
          <Text style={styles.emptyTitle}>
            {activeTab === "all" ? "No notifications yet" : `No ${activeTab} notifications`}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === "all"
              ? "Order updates and promotions will appear here"
              : "Try a different filter above"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, idx) =>
            item.kind === "header" ? `h-${item.group}` : `n-${item.data.id}-${idx}`
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={PINK}
              colors={[PINK]}
            />
          }
          renderItem={({ item }) => {
            if (item.kind === "header") {
              return <GroupHeader label={item.group} count={item.count} />;
            }
            return (
              <NotifRow
                item={item.data}
                onPress={handleNotifPress}
              />
            );
          }}
          ListFooterComponent={
            listData.length > 0 ? (
              <Text style={styles.footer}>
                {all.length} notification{all.length !== 1 ? "s" : ""} total
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  unreadBadge: {
    backgroundColor: PINK,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 80,
    justifyContent: "flex-end",
  },
  markAllText: {
    color: PINK,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  /* Tabs */
  tabsWrap: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  tabActive: {
    backgroundColor: "#FFF0F5",
    borderColor: PINK,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#777",
  },
  tabTextActive: {
    color: PINK,
    fontFamily: "Inter_700Bold",
  },
  tabCount: {
    backgroundColor: "#E0E0E0",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tabCountText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#555" },

  /* List */
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === "web" ? 34 + 84 : 90,
    gap: 6,
  },

  /* Group header */
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  groupLine: { flex: 1, height: 1, backgroundColor: "#E0E0E0" },
  groupLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  groupLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  groupCount: {
    backgroundColor: "#EEEEEE",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  groupCountText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#777" },

  /* Notification card */
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderLeftWidth: 0,
    borderLeftColor: "transparent",
  },
  cardRead: {
    backgroundColor: "#FAFAFA",
    shadowOpacity: 0.02,
    elevation: 0,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: { flex: 1, gap: 3 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  typePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typePillText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  time: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#BDBDBD" },
  title: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#666",
    lineHeight: 18,
  },
  titleUnread: {
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
  },
  body: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#888",
    lineHeight: 18,
  },
  dotWrap: { paddingTop: 2 },

  /* Empty */
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#555",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#AAA",
    textAlign: "center",
    lineHeight: 18,
  },
  loginBtn: {
    marginTop: 8,
    backgroundColor: PINK,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  loginBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  /* Footer */
  footer: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#CCC",
    marginTop: 16,
    marginBottom: 8,
  },
});
