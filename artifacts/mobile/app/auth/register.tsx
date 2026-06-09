import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
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
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGoogleConfig } from "@/hooks/useGoogleConfig";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { API_BASE_URL } from "@/lib/config";

WebBrowser.maybeCompleteAuthSession();

type Step = "form" | "verify";

const BASE_URL = API_BASE_URL;

function OtpBoxes({ code, focused, onPress }: { code: string; focused: boolean; onPress: () => void }) {
  return (
    <Pressable style={otpStyles.row} onPress={onPress}>
      {Array.from({ length: 6 }).map((_, i) => {
        const char = code[i] ?? "";
        const isActive = focused && i === Math.min(code.length, 5);
        const isFilled = !!char;
        return (
          <View
            key={i}
            style={[
              otpStyles.box,
              isFilled && otpStyles.boxFilled,
              isActive && otpStyles.boxActive,
            ]}
          >
            {isFilled ? (
              <Text style={otpStyles.char}>{char}</Text>
            ) : isActive ? (
              <View style={otpStyles.cursor} />
            ) : (
              <View style={otpStyles.dot} />
            )}
          </View>
        );
      })}
    </Pressable>
  );
}

const otpStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, justifyContent: "center", paddingVertical: 8 },
  box: {
    width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center",
  },
  boxFilled: { borderColor: "#E91E63", backgroundColor: "#FFF0F5" },
  boxActive: { borderColor: "#E91E63", backgroundColor: "#fff", shadowColor: "#E91E63", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  char: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#111" },
  cursor: { width: 2, height: 24, backgroundColor: "#E91E63", borderRadius: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D1D5DB" },
});

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setAuth } = useAuth();
  const { showAlert } = useAlert();
  const { siteName } = useTheme();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const[email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const[password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const[showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const[resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  },[]);

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

  const { googleClientId, googleAndroidClientId, googleIosClientId, isLoading: configLoading } = useGoogleConfig();
  const codeInputRef = useRef<TextInput>(null);

  const validateForm = (): string | null => {
    if (!name.trim()) return "Full name is required";
    if (!email.trim()) return "Email is required";
    if (!phone.trim()) return "Phone number is required";
    if (phone.trim().length < 10) return "Please enter a valid phone number";
    if (!password) return "Password is required";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number";
    return null;
  };

  const handleSendCode = async () => {
    setError(null);
    const formError = validateForm();
    if (formError) { setError(formError); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/send-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? "Failed to send verification code";
        showAlert({ title: "Registration Error", message: msg });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      setInfo("A 6-digit verification code has been sent to your email.");
      setStep("verify");
      setCode("");
      startResendTimer();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => { codeInputRef.current?.focus(); setCodeFocused(true); }, 300);
    } catch (err: any) {
      setError(`Network error: ${err.message || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setError(null);
    setCode("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/send-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to resend code"); return; }
      setInfo("A new code has been sent to your email.");
      startResendTimer();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(`Network error: ${err.message || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    if (!code.trim() || code.trim().length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim(),
          referralCode: referralCode.trim() || undefined,
          verificationCode: code.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      
      await setAuth(data.user, data.token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        router.replace("/(tabs)" as any);
      }, 100);
      
    } catch (err: any) {
      setError(`Network error: ${err.message || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  };

  const renderGoogleSection = () => {
    if (configLoading) return null;
    if (!googleClientId) {
      return (
        <View style={styles.googleSetupRow}>
          <Feather name="alert-circle" size={15} color="#D97706" />
          <Text style={styles.googleSetupText}>Google Sign-in not configured — set it up in Admin → Settings</Text>
        </View>
      );
    }
    return (
      <>
        <GoogleSignInButton webClientId={googleClientId} androidClientId={googleAndroidClientId} iosClientId={googleIosClientId} onError={setError} />
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or sign up with email</Text>
          <View style={styles.orLine} />
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      {step === "form" && (
        <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 16, backgroundColor: colors.primary }]}>
          <Pressable style={styles.closeBtn} onPress={() => router.dismiss()} testID="btn-close-register">
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.brandTitle}>Join {siteName}</Text>
          <Text style={styles.tagline}>Create your account and start shopping</Text>
        </View>
      )}
      {step === "verify" && (
        <View style={[styles.verifyHeader, { paddingTop: Platform.OS === "web" ? 16 : insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => { setStep("form"); setCode(""); setError(null); setInfo(null); }} testID="btn-close-register">
            <Feather name="arrow-left" size={20} color="#333" />
          </Pressable>
        </View>
      )}

      <View style={styles.form}>
        {error ? (
          <View style={[styles.alertBox, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={[styles.alertText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}
        {info && !error ? (
          <View style={[styles.alertBox, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
            <Feather name="check-circle" size={15} color="#059669" />
            <Text style={[styles.alertText, { color: "#065F46" }]}>{info}</Text>
          </View>
        ) : null}

        {step === "form" && (
          <>
            {renderGoogleSection()}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Full Name</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="user" size={16} color={colors.mutedForeground} />
                <TextInput style={[styles.input, { color: colors.foreground }]} placeholder="Enter your full name" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} autoCapitalize="words" autoComplete="off" importantForAutofill="no" testID="input-name" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="mail" size={16} color={colors.mutedForeground} />
                <TextInput style={[styles.input, { color: colors.foreground }]} placeholder="Enter your email" placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="off" importantForAutofill="no" testID="input-email" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Phone Number <Text style={[styles.required, { color: colors.primary }]}>*</Text>
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="phone" size={16} color={colors.mutedForeground} />
                <TextInput style={[styles.input, { color: colors.foreground }]} placeholder="e.g. 01712345678" placeholderTextColor={colors.mutedForeground} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="off" importantForAutofill="no" testID="input-phone" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} />
                <TextInput style={[styles.input, { color: colors.foreground }]} placeholder="Min. 8 chars, 1 uppercase, 1 number" placeholderTextColor={colors.mutedForeground} value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoComplete="off" importantForAutofill="no" testID="input-password" />
                <Pressable onPress={() => setShowPw(!showPw)} testID="btn-toggle-pw">
                  <Feather name={showPw ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Referral Code <Text style={[styles.optional, { color: colors.mutedForeground }]}>(Optional)</Text>
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="gift" size={16} color={colors.mutedForeground} />
                <TextInput style={[styles.input, { color: colors.foreground }]} placeholder="Enter referral code" placeholderTextColor={colors.mutedForeground} value={referralCode} onChangeText={(t) => setReferralCode(t.toUpperCase())} autoCapitalize="characters" testID="input-referral" />
              </View>
            </View>

            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleSendCode}
              disabled={loading}
              testID="btn-send-verification"
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.primaryBtnText}>Send Verification Code</Text>}
            </Pressable>

            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: colors.mutedForeground }]}>Already have an account? </Text>
              <Pressable onPress={() => router.replace("/auth/login" as any)} testID="btn-go-login">
                <Text style={[styles.loginLink, { color: colors.primary }]}>Login</Text>
              </Pressable>
            </View>
          </>
        )}

        {step === "verify" && (
          <>
            <View style={styles.otpHero}>
              <View style={[styles.otpIconCircle, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="mail" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.otpTitle, { color: colors.foreground }]}>Check your email</Text>
              <Text style={[styles.otpSubtitle, { color: colors.mutedForeground }]}>
                We sent a 6-digit code to
              </Text>
              <View style={[styles.emailPill, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="at-sign" size={13} color={colors.mutedForeground} />
                <Text style={[styles.emailPillText, { color: colors.foreground }]} numberOfLines={1}>{email}</Text>
              </View>
            </View>

            <TextInput
              ref={codeInputRef}
              style={styles.hiddenInput}
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
              onFocus={() => setCodeFocused(true)}
              onBlur={() => setCodeFocused(false)}
              keyboardType="number-pad"
              maxLength={6}
              caretHidden
              testID="input-otp"
            />

            <OtpBoxes
              code={code}
              focused={codeFocused}
              onPress={() => { codeInputRef.current?.focus(); setCodeFocused(true); }}
            />

            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (loading || code.length < 6) ? 0.6 : 1 }]}
              onPress={handleRegister}
              disabled={loading || code.length < 6}
              testID="btn-register"
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.primaryBtnText}>Create Account</Text>}
            </Pressable>

            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: colors.mutedForeground }]}>Didn't receive it? </Text>
              {resendTimer > 0 ? (
                <Text style={[styles.loginLink, { color: colors.mutedForeground }]}>
                  Resend in {resendTimer}s
                </Text>
              ) : (
                <Pressable onPress={handleResendCode} disabled={loading} testID="btn-resend">
                  <Text style={[styles.loginLink, { color: colors.primary }]}>Resend code</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              style={styles.wrongEmailBtn}
              onPress={() => { setStep("form"); setCode(""); setError(null); setInfo(null); }}
            >
              <Feather name="edit-2" size={12} color={colors.mutedForeground} />
              <Text style={[styles.wrongEmailText, { color: colors.mutedForeground }]}>Wrong email? Go back</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: 24, paddingBottom: 40 },
  closeBtn: { position: "absolute", top: (Platform.OS === "web" ? 0 : 44) + 8, right: 20, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  brandTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 20 },
  tagline: { fontSize: 14, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", marginTop: 6 },

  verifyHeader: { paddingHorizontal: 16, paddingBottom: 4 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  form: { flex: 1, padding: 24, gap: 14 },
  alertBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  alertText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  googleSetupRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 12 },
  googleSetupText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#92400E" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: "#EEEEEE" },
  orText: { fontSize: 12, color: "#999", fontFamily: "Inter_400Regular" },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  required: { fontFamily: "Inter_600SemiBold" },
  optional: { fontFamily: "Inter_400Regular", fontSize: 12 },
  inputWrapper: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", outlineWidth: 0 } as any,
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  loginText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  loginLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  otpHero: { alignItems: "center", paddingTop: 8, paddingBottom: 8, gap: 8 },
  otpIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  otpTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  otpSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  emailPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, maxWidth: "90%" },
  emailPillText: { fontSize: 13, fontFamily: "Inter_500Medium", flexShrink: 1 },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 } as any,
  wrongEmailBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 4 },
  wrongEmailText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});