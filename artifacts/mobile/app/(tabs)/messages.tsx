import { Feather } from "@expo/vector-icons";
import {
  useListConversations,
  useListMessages,
  useSendMessage,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import React, { useState, useRef, useEffect } from "react";
import { API_BASE_URL } from "@/lib/config";
import {
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import { useRouter } from "expo-router";

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();
  const [message, setMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const { data: conversations } = useListConversations({ query: { enabled: !!token, queryKey: getListConversationsQueryKey() } });
  const adminConvUserId = 1;

  const { data: messagesData } = useListMessages(
    { conversationUserId: adminConvUserId },
    { query: { enabled: !!token, queryKey: getListMessagesQueryKey({ conversationUserId: adminConvUserId }), refetchInterval: 5000 } }
  );
  const messages = Array.isArray(messagesData) ? messagesData : [];

  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/config`)
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (data?.whatsappNumber) setWhatsappNumber(data.whatsappNumber);
      })
      .catch(() => {});
  }, []);

  const sendMsg = useSendMessage();

  const handleSend = () => {
    if (!message.trim() || !token) return;
    const body = message.trim();
    setMessage("");
    sendMsg.mutate(
      { data: { body } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey({ conversationUserId: adminConvUserId }) });
          setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
        },
      }
    );
  };

  const handleWhatsApp = () => {
    if (!whatsappNumber) return;
    const url = `https://wa.me/${whatsappNumber}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        showAlert({ title: "WhatsApp not available", message: `Please contact us at +${whatsappNumber}` });
      }
    }).catch(() => {
      showAlert({ title: "WhatsApp not available", message: `Please contact us at +${whatsappNumber}` });
    });
  };

  if (!token) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.emptyState}>
          <Feather name="message-circle" size={64} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Chat Support</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Login to chat with our support team</Text>
          <Pressable style={[styles.loginBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/auth/login" as any)} testID="btn-login-chat">
            <Text style={styles.loginBtnText}>Login</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <View style={styles.headerInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Feather name="headphones" size={16} color="#fff" />
          </View>
          <View>
            <Text style={[styles.headerName, { color: colors.foreground }]}>Support Team</Text>
            <Text style={[styles.headerStatus, { color: "#22C55E" }]}>Online</Text>
          </View>
        </View>

        {/* WhatsApp button */}
        {whatsappNumber ? (
          <Pressable
            style={styles.waBtn}
            onPress={handleWhatsApp}
            testID="btn-whatsapp"
          >
            <Text style={styles.waBtnText}>WhatsApp</Text>
            <Feather name="external-link" size={13} color="#fff" style={{ marginLeft: 4 }} />
          </Pressable>
        ) : null}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={[...messages].reverse()}
        inverted
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!!messages.length}
        ListEmptyComponent={
          <View style={styles.welcomeMsg}>
            <Text style={[styles.welcomeText, { color: colors.mutedForeground }]}>
              👋 Hi! How can we help you today?
            </Text>
            {whatsappNumber ? (
              <Pressable style={styles.waAltBtn} onPress={handleWhatsApp}>
                <Text style={styles.waAltText}>Or message us on WhatsApp</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }: { item: any }) => {
          const isMe = item.senderRole === "customer";
          return (
            <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
              {!isMe && (
                <View style={[styles.msgAvatar, { backgroundColor: colors.primary }]}>
                  <Feather name="headphones" size={12} color="#fff" />
                </View>
              )}
              <View style={[
                styles.bubble,
                isMe
                  ? [styles.myBubble, { backgroundColor: colors.primary }]
                  : [styles.theirBubble, { backgroundColor: colors.card, borderColor: colors.border }],
              ]}>
                {!isMe && item.senderName && (
                  <Text style={[styles.senderLabel, { color: colors.primary }]}>{item.senderName}</Text>
                )}
                <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>{item.body}</Text>
                <Text style={[styles.msgTime, { color: isMe ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Input */}
      <View style={[styles.inputArea, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { backgroundColor: "#f5f5f5", color: colors.foreground }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.mutedForeground}
          value={message}
          onChangeText={setMessage}
          multiline
          testID="input-message"
        />
        <Pressable
          style={[styles.sendBtn, { backgroundColor: message.trim() ? colors.primary : "#e0e0e0" }]}
          onPress={handleSend}
          disabled={!message.trim()}
          testID="btn-send"
        >
          <Feather name="send" size={18} color={message.trim() ? "#fff" : colors.mutedForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  headerStatus: { fontSize: 12, fontFamily: "Inter_400Regular" },
  waBtn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#25D366",
  },
  waBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  loginBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 24 },
  loginBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  welcomeMsg: { alignItems: "center", paddingVertical: 20, gap: 12 },
  welcomeText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  waAltBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "#25D366" },
  waAltText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#25D366" },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginVertical: 2 },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "72%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  myBubble: { borderBottomRightRadius: 4 },
  theirBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  senderLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  msgTime: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3, alignSelf: "flex-end" },
  inputArea: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100, fontFamily: "Inter_400Regular" },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
