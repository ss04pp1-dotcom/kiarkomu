import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useUpdateMe, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { API_BASE_URL } from "@/lib/config";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState, useEffect, useRef } from "react";
import {
  ActionSheetIOS,
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

const PINK = "#E91E63";
const BLUE = "#1565C0";

const BASE_URL = API_BASE_URL;

/* ─── Upload image to server ─────────────────────────────────────── */
async function uploadImage(uri: string, token: string): Promise<string> {
  const filename = uri.split("/").pop() ?? "avatar.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  const formData = new FormData();
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append("file", blob, filename);
  } else {
    (formData as any).append("file", { uri, name: filename, type });
  }

  const uploadUrl = `${API_BASE_URL}/api/upload`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  const json = await res.json();
  return json.url as string;
}

/* ─── Animated upload progress ring ─────────────────────────────── */
function UploadRing({ visible }: { visible: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 900, useNativeDriver: true })
      ).start();
    } else {
      spin.setValue(0);
    }
  }, [visible]);
  if (!visible) return null;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View style={ring.overlay}>
      <Animated.View style={[ring.spinner, { transform: [{ rotate }] }]} />
    </View>
  );
}
const ring = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
  },
});

/* ─── Source picker sheet (iOS native / cross-platform modal) ────── */
function PickerSheet({
  visible,
  onClose,
  onGallery,
  onCamera,
  onRemove,
  hasAvatar,
}: {
  visible: boolean;
  onClose: () => void;
  onGallery: () => void;
  onCamera: () => void;
  onRemove: () => void;
  hasAvatar: boolean;
}) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheet.backdrop} onPress={onClose} />
      <View style={sheet.container}>
        <View style={sheet.handle} />
        <Text style={sheet.title}>Update Profile Photo</Text>

        <Pressable style={sheet.option} onPress={onGallery}>
          <View style={[sheet.optionIcon, { backgroundColor: "#E3F2FD" }]}>
            <Feather name="image" size={20} color={BLUE} />
          </View>
          <Text style={sheet.optionText}>Choose from Gallery</Text>
          <Feather name="chevron-right" size={16} color="#CCC" />
        </Pressable>

        <Pressable style={sheet.option} onPress={onCamera}>
          <View style={[sheet.optionIcon, { backgroundColor: "#FFF0F5" }]}>
            <Feather name="camera" size={20} color={PINK} />
          </View>
          <Text style={sheet.optionText}>Take a Photo</Text>
          <Feather name="chevron-right" size={16} color="#CCC" />
        </Pressable>

        {hasAvatar && (
          <Pressable style={sheet.option} onPress={onRemove}>
            <View style={[sheet.optionIcon, { backgroundColor: "#FFF5F5" }]}>
              <Feather name="trash-2" size={20} color="#EF4444" />
            </View>
            <Text style={[sheet.optionText, { color: "#EF4444" }]}>Remove Photo</Text>
            <Feather name="chevron-right" size={16} color="#CCC" />
          </Pressable>
        )}

        <Pressable style={sheet.cancelBtn} onPress={onClose}>
          <Text style={sheet.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
const sheet = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#DDD",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 16,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#1A1A1A",
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: "#F5F5F5",
    borderRadius: 14,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#555",
  },
});

/* ─── Input Field ─────────────────────────────────────────────────── */
function Field({
  label,
  value,
  onChange,
  icon,
  placeholder,
  keyboardType,
  autoCapitalize,
  hint,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: string;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  hint?: string;
  maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={field.wrap}>
      <Text style={field.label}>{label}</Text>
      <View
        style={[
          field.row,
          focused && { borderColor: PINK, backgroundColor: "#FFF8FB" },
        ]}
      >
        <Feather name={icon as any} size={17} color={focused ? PINK : "#BDBDBD"} />
        <TextInput
          style={field.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? label}
          placeholderTextColor="#BDBDBD"
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "none"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={maxLength}
        />
        {value.length > 0 && (
          <Pressable onPress={() => onChange("")}>
            <Feather name="x-circle" size={16} color="#CCC" />
          </Pressable>
        )}
      </View>
      {hint && <Text style={field.hint}>{hint}</Text>}
    </View>
  );
}
const field = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 4 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#FAFAFA",
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#1A1A1A",
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#BDBDBD",
    marginLeft: 2,
  },
});

/* ─── Main screen ─────────────────────────────────────────────────── */
export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user, setAuth } = useAuth();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const { data: profile } = useGetMe({
    query: { enabled: !!token, queryKey: getGetMeQueryKey() },
  });
  const updateMe = useUpdateMe();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const { showAlert, showConfirm } = useAlert();
  const [dirty, setDirty] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPw, setEmailCurrentPw] = useState("");
  const [showEmailPw, setShowEmailPw] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const src = profile ?? user;
    if (src) {
      setName(src.name ?? "");
      setPhone((src as any).phone ?? "");
      setAvatarUrl((src as any).avatarUrl ?? "");
    }
  }, [profile, user]);

  const markDirty = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setDirty(true);
  };

  /* ── Image picking ── */
  const pickFromGallery = async () => {
    setSheetVisible(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert({ title: "Permission needed", message: "Allow photo access to change your avatar." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      await doUpload(result.assets[0].uri);
    }
  };

  const pickFromCamera = async () => {
    setSheetVisible(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showAlert({ title: "Permission needed", message: "Allow camera access to take a photo." });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      await doUpload(result.assets[0].uri);
    }
  };

  const doUpload = async (uri: string) => {
    if (!token) return;
    setUploading(true);
    try {
      const url = await uploadImage(uri, token);
      setAvatarUrl(url);
      setDirty(true);
    } catch {
      showAlert({ title: "Upload failed", message: "Could not upload image. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  /* ── Save ── */
  const handleSave = () => {
    if (!name.trim()) {
      showAlert({ title: "Name required", message: "Please enter your full name." });
      return;
    }
    updateMe.mutate(
      {
        data: {
          name: name.trim(),
          phone: phone.trim() || undefined,
          avatarUrl: avatarUrl || undefined,
        },
      },
      {
        onSuccess: (updated: any) => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          if (user && token) setAuth(updated, token);
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setDirty(false);
          router.back();
        },
        onError: () => showAlert({ title: "Error", message: "Failed to update profile." }),
      }
    );
  };

  const handleBack = () => {
    if (dirty) {
      showConfirm("Discard changes?", "You have unsaved changes.", () => router.back(), "Discard");
    } else {
      router.back();
    }
  };

  const handleChangeEmail = async () => {
    setEmailMsg(null);
    if (!newEmail.trim()) { setEmailMsg({ ok: false, text: "Please enter a new email address." }); return; }
    if (!emailCurrentPw) { setEmailMsg({ ok: false, text: "Please enter your current password." }); return; }
    setEmailLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/change-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newEmail: newEmail.trim().toLowerCase(), currentPassword: emailCurrentPw }),
      });
      const data = await res.json();
      if (!res.ok) { setEmailMsg({ ok: false, text: data.error ?? "Failed to change email." }); return; }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEmailMsg({ ok: true, text: "Email updated successfully." });
      setNewEmail("");
      setEmailCurrentPw("");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      setEmailMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!currentPw) { setPwMsg({ ok: false, text: "Please enter your current password." }); return; }
    if (!newPw || newPw.length < 6) { setPwMsg({ ok: false, text: "New password must be at least 6 characters." }); return; }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "New passwords do not match." }); return; }
    setPwLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwMsg({ ok: false, text: data.error ?? "Failed to change password." }); return; }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPwMsg({ ok: true, text: "Password changed successfully." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch {
      setPwMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setPwLoading(false);
    }
  };

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");

  const isBusy = uploading || updateMe.isPending;

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={[styles.header, { paddingTop: topPad + 8 }]}>
            <Pressable style={styles.iconBtn} onPress={handleBack} testID="btn-back">
              <Feather name="arrow-left" size={20} color="#333" />
            </Pressable>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <Pressable
              style={[
                styles.saveBtn,
                (!dirty || isBusy) && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={!dirty || isBusy}
              testID="btn-save"
            >
              {updateMe.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </View>

          {/* ── Avatar section ── */}
          <View style={styles.avatarSection}>
            <Pressable
              style={styles.avatarWrap}
              onPress={() => setSheetVisible(true)}
              disabled={isBusy}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>
                    {initials || <Feather name="user" size={32} color="#fff" />}
                  </Text>
                </View>
              )}
              <UploadRing visible={uploading} />
              <View style={styles.cameraBtn}>
                {uploading ? (
                  <ActivityIndicator size="small" color={PINK} />
                ) : (
                  <Feather name="camera" size={14} color={PINK} />
                )}
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>
              {uploading ? "Uploading…" : "Tap to change photo"}
            </Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personal Information</Text>
            <Field
              label="Full Name"
              value={name}
              onChange={markDirty(setName)}
              icon="user"
              placeholder="Your full name"
              autoCapitalize="words"
              maxLength={60}
            />
            <Field
              label="Phone Number"
              value={phone}
              onChange={markDirty(setPhone)}
              icon="phone"
              placeholder="01XXXXXXXXX"
              keyboardType="phone-pad"
              hint="Used for delivery & account recovery"
            />
          </View>

          {/* ── Avatar URL card (advanced) ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile Photo URL</Text>
            <Field
              label="Photo URL"
              value={avatarUrl}
              onChange={markDirty(setAvatarUrl)}
              icon="link"
              placeholder="https://…"
              keyboardType="url"
              hint="Or paste a direct image link"
            />
            {avatarUrl ? (
              <View style={styles.previewRow}>
                <Image source={{ uri: avatarUrl }} style={styles.previewThumb} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.previewLabel}>Preview</Text>
                  <Text style={styles.previewUrl} numberOfLines={1}>{avatarUrl}</Text>
                </View>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => { setAvatarUrl(""); setDirty(true); }}
                >
                  <Feather name="x" size={14} color="#EF4444" />
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* ── Change Email ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Change Email</Text>
            <Text style={styles.currentVal}>
              Current: <Text style={{ color: BLUE }}>{profile?.email ?? user?.email ?? "—"}</Text>
            </Text>
            {emailMsg && (
              <View style={[styles.msgBox, { backgroundColor: emailMsg.ok ? "#D1FAE5" : "#FEE2E2" }]}>
                <Feather name={emailMsg.ok ? "check-circle" : "alert-circle"} size={14} color={emailMsg.ok ? "#059669" : "#DC2626"} />
                <Text style={[styles.msgText, { color: emailMsg.ok ? "#065F46" : "#991B1B" }]}>{emailMsg.text}</Text>
              </View>
            )}
            <View style={styles.secureRow}>
              <Feather name="mail" size={17} color="#BDBDBD" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.secureInput}
                placeholder="New email address"
                placeholderTextColor="#BDBDBD"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.secureRow}>
              <Feather name="lock" size={17} color="#BDBDBD" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.secureInput}
                placeholder="Current password to confirm"
                placeholderTextColor="#BDBDBD"
                value={emailCurrentPw}
                onChangeText={setEmailCurrentPw}
                secureTextEntry={!showEmailPw}
              />
              <Pressable onPress={() => setShowEmailPw(v => !v)}>
                <Feather name={showEmailPw ? "eye-off" : "eye"} size={16} color="#BDBDBD" />
              </Pressable>
            </View>
            <Pressable
              style={[styles.changeBtn, { backgroundColor: BLUE, opacity: emailLoading ? 0.7 : 1 }]}
              onPress={handleChangeEmail}
              disabled={emailLoading}
            >
              {emailLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.changeBtnText}>Update Email</Text>}
            </Pressable>
          </View>

          {/* ── Change Password ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Change Password</Text>
            {pwMsg && (
              <View style={[styles.msgBox, { backgroundColor: pwMsg.ok ? "#D1FAE5" : "#FEE2E2" }]}>
                <Feather name={pwMsg.ok ? "check-circle" : "alert-circle"} size={14} color={pwMsg.ok ? "#059669" : "#DC2626"} />
                <Text style={[styles.msgText, { color: pwMsg.ok ? "#065F46" : "#991B1B" }]}>{pwMsg.text}</Text>
              </View>
            )}
            <View style={styles.secureRow}>
              <Feather name="lock" size={17} color="#BDBDBD" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.secureInput}
                placeholder="Current password"
                placeholderTextColor="#BDBDBD"
                value={currentPw}
                onChangeText={setCurrentPw}
                secureTextEntry={!showCurrentPw}
              />
              <Pressable onPress={() => setShowCurrentPw(v => !v)}>
                <Feather name={showCurrentPw ? "eye-off" : "eye"} size={16} color="#BDBDBD" />
              </Pressable>
            </View>
            <View style={styles.secureRow}>
              <Feather name="lock" size={17} color="#BDBDBD" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.secureInput}
                placeholder="New password (min. 6 chars)"
                placeholderTextColor="#BDBDBD"
                value={newPw}
                onChangeText={setNewPw}
                secureTextEntry={!showNewPw}
              />
              <Pressable onPress={() => setShowNewPw(v => !v)}>
                <Feather name={showNewPw ? "eye-off" : "eye"} size={16} color="#BDBDBD" />
              </Pressable>
            </View>
            <View style={styles.secureRow}>
              <Feather name="check" size={17} color="#BDBDBD" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.secureInput}
                placeholder="Confirm new password"
                placeholderTextColor="#BDBDBD"
                value={confirmPw}
                onChangeText={setConfirmPw}
                secureTextEntry={!showConfirmPw}
              />
              <Pressable onPress={() => setShowConfirmPw(v => !v)}>
                <Feather name={showConfirmPw ? "eye-off" : "eye"} size={16} color="#BDBDBD" />
              </Pressable>
            </View>
            <Pressable
              style={[styles.changeBtn, { backgroundColor: PINK, opacity: pwLoading ? 0.7 : 1 }]}
              onPress={handleChangePassword}
              disabled={pwLoading}
            >
              {pwLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.changeBtnText}>Update Password</Text>}
            </Pressable>
          </View>

          {/* ── Account info ── */}
          <View style={[styles.card, { marginTop: 8 }]}>
            <Text style={styles.cardTitle}>Account</Text>
            <View style={styles.infoRow}>
              <MaterialIcons name="verified-user" size={18} color="#4CAF50" />
              <Text style={styles.infoText}>Your account is verified</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="mail" size={17} color="#9E9E9E" />
              <Text style={styles.infoText}>{profile?.email ?? user?.email ?? "—"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="shield" size={17} color="#9E9E9E" />
              <Text style={styles.infoText}>
                Role:{" "}
                <Text style={{ fontFamily: "Inter_600SemiBold", color: BLUE, textTransform: "capitalize" }}>
                  {(profile as any)?.role ?? (user as any)?.role ?? "customer"}
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Image source picker sheet ── */}
      <PickerSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onGallery={pickFromGallery}
        onCamera={pickFromCamera}
        onRemove={() => {
          setAvatarUrl("");
          setDirty(true);
          setSheetVisible(false);
        }}
        hasAvatar={!!avatarUrl}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
  },
  saveBtn: {
    backgroundColor: PINK,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 22,
    minWidth: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },

  /* Avatar */
  avatarSection: {
    alignItems: "center",
    paddingVertical: 28,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  avatarWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 10,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: PINK,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    lineHeight: 44,
  },
  cameraBtn: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: PINK,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  avatarHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#9E9E9E",
  },

  /* Cards */
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },

  /* Preview */
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 10,
  },
  previewThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DDD",
  },
  previewLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#555",
  },
  previewUrl: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#9E9E9E",
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Account info */
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#555",
  },

  /* Change email / password */
  currentVal: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#777",
    marginBottom: 4,
  },
  msgBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    padding: 10,
  },
  msgText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#FAFAFA",
  },
  secureInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#1A1A1A",
  },
  changeBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  changeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
