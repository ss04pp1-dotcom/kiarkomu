import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import CustomAlert, { type AlertButton } from "@/components/CustomAlert";
import { useAppConfig } from "@/contexts/ConfigContext";
import { API_BASE_URL } from "@/lib/config";

const PINK = "#E91E63";

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function SettingRow({
  icon, label, subtitle, value, onPress, danger, rightEl,
}: {
  icon: string; label: string; subtitle?: string;
  value?: string; onPress?: () => void; danger?: boolean;
  rightEl?: React.ReactNode;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress && !rightEl}>
      <View style={[styles.iconWrap, danger && { backgroundColor: "#FFF0F0" }]}>
        <Feather name={icon as any} size={18} color={danger ? "#E53935" : PINK} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && { color: "#E53935" }]}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {rightEl ?? (
        value ? <Text style={styles.rowValue}>{value}</Text>
          : onPress ? <Feather name="chevron-right" size={16} color="#BDBDBD" /> : null
      )}
    </Pressable>
  );
}

function ToggleRow({
  icon, label, subtitle, value, onChange,
}: { icon: string; label: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <SettingRow
      icon={icon} label={label} subtitle={subtitle}
      rightEl={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: "#DDD", true: PINK }}
          thumbColor="#fff"
        />
      }
    />
  );
}

function ChangePasswordModal({ visible, onClose, token }: { visible: boolean; onClose: () => void; token: string | null }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [localAlert, setLocalAlert] = useState<{ visible: boolean; title: string; message: string; buttons?: AlertButton[] }>({ visible: false, title: "", message: "" });
  const showLocalAlert = (title: string, message: string, buttons?: AlertButton[]) =>
    setLocalAlert({ visible: true, title, message, buttons });

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
    setShowCurrent(false);
    setShowNew(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!currentPassword.trim()) { showLocalAlert("Required", "Please enter your current password."); return; }
    if (newPassword.length < 8) { showLocalAlert("Too Short", "New password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(newPassword)) { showLocalAlert("Too Weak", "New password must contain at least one uppercase letter."); return; }
    if (!/[0-9]/.test(newPassword)) { showLocalAlert("Too Weak", "New password must contain at least one number."); return; }
    if (newPassword !== confirmPassword) { showLocalAlert("Mismatch", "New passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showLocalAlert("Error", data.error ?? "Failed to change password.");
        return;
      }
      showLocalAlert("Success", "Your password has been changed.", [{ text: "OK", onPress: handleClose }]);
    } catch {
      showLocalAlert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={modal.container}>
          <View style={modal.header}>
            <Text style={modal.title}>Change Password</Text>
            <Pressable style={modal.closeBtn} onPress={handleClose}>
              <Feather name="x" size={20} color="#1A1A1A" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={modal.scroll} keyboardShouldPersistTaps="handled">
            <Text style={modal.hint}>
              Password must be at least 8 characters and include an uppercase letter and a number.
            </Text>

            {/* Current password */}
            <View style={modal.field}>
              <Text style={modal.label}>Current Password</Text>
              <View style={modal.inputRow}>
                <TextInput
                  style={modal.inputInRow}
                  placeholder="Enter current password"
                  placeholderTextColor="#9CA3AF"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrent}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowCurrent(v => !v)} style={modal.eye}>
                  <Feather name={showCurrent ? "eye-off" : "eye"} size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            </View>

            {/* New password */}
            <View style={modal.field}>
              <Text style={modal.label}>New Password</Text>
              <View style={modal.inputRow}>
                <TextInput
                  style={modal.inputInRow}
                  placeholder="Enter new password"
                  placeholderTextColor="#9CA3AF"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowNew(v => !v)} style={modal.eye}>
                  <Feather name={showNew ? "eye-off" : "eye"} size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            </View>

            {/* Confirm new password */}
            <View style={modal.field}>
              <Text style={modal.label}>Confirm New Password</Text>
              <TextInput
                style={modal.input}
                placeholder="Re-enter new password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <Pressable
              style={[modal.btn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={modal.btnText}>Update Password</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <CustomAlert
        visible={localAlert.visible}
        title={localAlert.title}
        message={localAlert.message}
        buttons={localAlert.buttons}
        onDismiss={() => setLocalAlert(prev => ({ ...prev, visible: false }))}
      />
    </Modal>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, token } = useAuth();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const { showAlert, showConfirm } = useAlert();
  const { config } = useAppConfig();

  const [pushNotifs, setPushNotifs] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promoNotifs, setPromoNotifs] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [changePwdVisible, setChangePwdVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Clears AsyncStorage keys (via AuthContext.logout), wipes the React Query
  // cache so stale user-specific data is not shown on the next login, and
  // resets the navigation stack to the login screen.
  const performLogout = async () => {
    await logout();
    queryClient.clear();
    router.replace("/(auth)/login" as any);
  };

  const handleLogout = () => {
    showConfirm(
      "Logout",
      "Are you sure you want to logout?",
      performLogout,
      "Logout"
    );
  };

  const handleDeleteAccount = () => {
    showConfirm(
      "Delete Account",
      "This is permanent and cannot be undone. All your orders, addresses, coins, and data will be erased.",
      async () => {
        setDeletingAccount(true);
        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showAlert({ title: "Error", message: data.error ?? "Failed to delete account." });
            return;
          }
          await performLogout();
        } catch {
          showAlert({ title: "Error", message: "Network error. Please try again." });
        } finally {
          setDeletingAccount(false);
        }
      },
      "Delete My Account"
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Notifications */}
        <SectionTitle label="NOTIFICATIONS" />
        <View style={styles.card}>
          <ToggleRow icon="bell" label="Push Notifications" subtitle="Get alerts on your device" value={pushNotifs} onChange={setPushNotifs} />
          <View style={styles.divider} />
          <ToggleRow icon="shopping-bag" label="Order Updates" subtitle="Shipped, delivered alerts" value={orderUpdates} onChange={setOrderUpdates} />
          <View style={styles.divider} />
          <ToggleRow icon="tag" label="Promotions & Offers" subtitle="Discounts and flash sales" value={promoNotifs} onChange={setPromoNotifs} />
        </View>

        {/* Appearance */}
        <SectionTitle label="APPEARANCE" />
        <View style={styles.card}>
          <ToggleRow icon="moon" label="Dark Mode" subtitle="Coming soon" value={darkMode} onChange={() => showAlert({ title: "Coming Soon", message: "Dark mode will be available in the next update." })} />
        </View>

        {/* Account */}
        <SectionTitle label="ACCOUNT" />
        <View style={styles.card}>
          <SettingRow icon="user" label="Edit Profile" onPress={() => router.push("/profile-edit" as any)} />
          <View style={styles.divider} />
          <SettingRow icon="map-pin" label="Manage Addresses" onPress={() => router.push("/addresses" as any)} />
          <View style={styles.divider} />
          <SettingRow icon="lock" label="Change Password" onPress={() => setChangePwdVisible(true)} />
        </View>

        {/* Legal */}
        <SectionTitle label="LEGAL & INFO" />
        <View style={styles.card}>
          <SettingRow
            icon="file-text"
            label="Privacy Policy"
            onPress={() => {
              const url = config?.privacyPolicyUrl || "https://shohure.com/privacy";
              Linking.openURL(url).catch(() => showAlert("Error", "Unable to open the link."));
            }}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="info"
            label="Terms of Service"
            onPress={() => {
              const url = config?.termsOfServiceUrl || "https://shohure.com/terms";
              Linking.openURL(url).catch(() => showAlert("Error", "Unable to open the link."));
            }}
          />
          <View style={styles.divider} />
          <SettingRow icon="smartphone" label="App Version" value="1.0.0" />
        </View>

        {/* Danger */}
        <SectionTitle label="DANGER ZONE" />
        <View style={styles.card}>
          <SettingRow icon="log-out" label="Logout" danger onPress={handleLogout} />
          <View style={styles.divider} />
          <SettingRow
            icon="trash-2"
            label={deletingAccount ? "Deleting..." : "Delete Account"}
            danger
            onPress={deletingAccount ? undefined : handleDeleteAccount}
          />
        </View>
      </ScrollView>

      <ChangePasswordModal
        visible={changePwdVisible}
        onClose={() => setChangePwdVisible(false)}
        token={token}
      />
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
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#9E9E9E", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  card: { backgroundColor: "#fff", marginHorizontal: 12, borderRadius: 14, overflow: "hidden", elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FFF0F5", alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#1A1A1A" },
  rowSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9E9E9E", marginTop: 1 },
  rowValue: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#9E9E9E" },
  divider: { height: 1, backgroundColor: "#F5F5F5", marginLeft: 62 },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
    backgroundColor: "#FFF",
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" },
  scroll: { padding: 20, gap: 16 },
  hint: { fontSize: 13, color: "#6B7280", lineHeight: 20, backgroundColor: "#F0F9FF", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#BAE6FD" },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151" },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, backgroundColor: "#FFF" },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: "#1A1A1A", backgroundColor: "#FFF", flex: 1,
  },
  inputInRow: {
    borderWidth: 0,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: "#1A1A1A", backgroundColor: "transparent", flex: 1,
  },
  eye: { paddingHorizontal: 12, paddingVertical: 12 },
  btn: {
    backgroundColor: PINK, borderRadius: 12, paddingVertical: 15,
    alignItems: "center", marginTop: 8,
    shadowColor: PINK, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  btnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
});
