import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { API_BASE_URL } from "@/lib/config";

const BASE_URL = API_BASE_URL;

type Step = "email" | "reset";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startResendTimer = () => {
    setResendTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestCode = async () => {
    setError(null);
    if (!email.trim()) { setError("Please enter your email address"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
      setSuccess("A 6-digit reset code has been sent to your email.");
      setStep("reset");
      startResendTimer();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    if (!code.trim() || code.trim().length !== 6) { setError("Enter the 6-digit code"); return; }
    if (!newPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Password must be at least 8 characters with one uppercase letter and one number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Reset failed"); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess("Password reset! You can now log in.");
      setTimeout(() => router.replace("/auth/login" as any), 1500);
    } catch (err: any) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 16, backgroundColor: colors.primary }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.dismiss()}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <Feather name="lock" size={28} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>Reset Password</Text>
        <Text style={styles.headerSub}>
          {step === "email" ? "Enter your email to receive a reset code" : "Enter the code we sent you"}
        </Text>
      </View>

      <View style={styles.form}>
        {error ? (
          <View style={[styles.alertBox, { backgroundColor: "#FEE2E2" }]}>
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={[styles.alertText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={[styles.alertBox, { backgroundColor: "#D1FAE5" }]}>
            <Feather name="check-circle" size={15} color="#059669" />
            <Text style={[styles.alertText, { color: "#065F46" }]}>{success}</Text>
          </View>
        ) : null}

        {step === "email" ? (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Email Address</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="mail" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Enter your account email"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="off"
                  importantForAutofill="no"
                />
              </View>
            </View>

            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleRequestCode}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Send Reset Code</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.emailChip}>
              <Feather name="mail" size={14} color={colors.mutedForeground} />
              <Text style={[styles.emailChipText, { color: colors.mutedForeground }]}>{email}</Text>
              <Pressable onPress={() => { setStep("email"); setSuccess(null); setError(null); }}>
                <Feather name="edit-2" size={13} color={colors.primary} />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>6-Digit Reset Code</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="hash" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground, letterSpacing: 4 }]}
                  placeholder="000000"
                  placeholderTextColor={colors.mutedForeground}
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>New Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPw}
                />
                <Pressable onPress={() => setShowPw(!showPw)}>
                  <Feather name={showPw ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Reset Password</Text>}
            </Pressable>

            {resendTimer > 0 ? (
              <Text style={[styles.resendText, { color: colors.mutedForeground, textAlign: "center" }]}>
                Resend in {resendTimer}s
              </Text>
            ) : (
              <Pressable style={{ alignItems: "center" }} onPress={handleRequestCode} disabled={loading}>
                <Text style={[styles.resendText, { color: colors.primary }]}>Resend code</Text>
              </Pressable>
            )}
          </>
        )}

        <Pressable onPress={() => router.replace("/auth/login" as any)} style={{ alignItems: "center" }}>
          <Text style={[styles.backText, { color: colors.mutedForeground }]}>← Back to Login</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 40, alignItems: "flex-start" },
  closeBtn: { position: "absolute", top: (Platform.OS === "web" ? 0 : 44) + 8, right: 20, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 20, marginBottom: 12 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 14, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", marginTop: 4 },
  form: { flex: 1, padding: 24, gap: 16 },
  alertBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, padding: 12 },
  alertText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  createBtn: { borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 4 },
  createBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emailChip: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 8, backgroundColor: "#F3F4F6" },
  emailChipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  inputWrapper: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", outlineWidth: 0 } as any,
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  resendText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  backText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
