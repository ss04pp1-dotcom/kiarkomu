import { Feather } from "@expo/vector-icons";
import { useLogin } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
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
import { useTheme } from "@/contexts/ThemeContext";
import { useGoogleConfig } from "@/hooks/useGoogleConfig";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { registerForPushNotificationsAsync } from "@/hooks/useNotifications";
import { API_BASE_URL } from "@/lib/config";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const[password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const[error, setError] = useState<string | null>(null);
  const login = useLogin();

  const { googleClientId, googleAndroidClientId, googleIosClientId, isLoading: configLoading } = useGoogleConfig();
  const { siteName } = useTheme();

  const handleLogin = () => {
    setError(null);
    if (!email || !password) { setError("Please fill in all fields"); return; }
    login.mutate(
      { data: { email: email.trim().toLowerCase(), password } },
      {
        onSuccess: async (data: any) => {
          await setAuth(data.user, data.token);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Save push token to server in the background — don't block navigation
          registerForPushNotificationsAsync()
            .then(pushToken => {
              if (!pushToken) return;
              return fetch(`${API_BASE_URL}/api/auth/me`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${data.token}`,
                },
                body: JSON.stringify({ pushToken }),
              });
            })
            .catch(() => {});
          router.replace("/(tabs)" as any);
        },
        onError: (err: any) => {
          setError(err?.message ?? "Invalid email or password");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
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
          <Text style={styles.orText}>or login with email</Text>
          <View style={styles.orLine} />
        </View>
      </>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.headerGradient, { paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 16, backgroundColor: colors.primary }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.dismiss()} testID="btn-close-login">
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.brandTitle}>{siteName}</Text>
        <Text style={styles.tagline}>Your favourite Bangladeshi marketplace</Text>
      </View>

      <View style={styles.form}>
        <Text style={[styles.formTitle, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.formSubtitle, { color: colors.mutedForeground }]}>Login to your account</Text>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}

        {renderGoogleSection()}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Feather name="mail" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Enter your email"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              testID="input-email"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Feather name="lock" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Enter your password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              autoComplete="current-password"
              testID="input-password"
            />
            <Pressable onPress={() => setShowPw(!showPw)} testID="btn-toggle-password">
              <Feather name={showPw ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[styles.loginBtn, { backgroundColor: colors.primary, opacity: login.isPending ? 0.7 : 1 }]}
          onPress={handleLogin}
          disabled={login.isPending}
          testID="btn-login"
        >
          <Text style={styles.loginBtnText}>{login.isPending ? "Logging in..." : "Login"}</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/auth/forgot-password" as any)} style={{ alignItems: "center" }}>
          <Text style={[styles.registerLink, { color: colors.primary, fontSize: 14 }]}>Forgot password?</Text>
        </Pressable>

        <View style={styles.registerRow}>
          <Text style={[styles.registerText, { color: colors.mutedForeground }]}>Don't have an account? </Text>
          <Pressable onPress={() => router.replace("/auth/register" as any)} testID="btn-go-register">
            <Text style={[styles.registerLink, { color: colors.primary }]}>Register</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingHorizontal: 24, paddingBottom: 40, position: "relative" },
  closeBtn: { position: "absolute", top: (Platform.OS === "web" ? 0 : 44) + 8, right: 20, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  brandTitle: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 20 },
  tagline: { fontSize: 14, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", marginTop: 6 },
  form: { flex: 1, padding: 24, gap: 16 },
  formTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  formSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: -8 },
  errorBox: { borderRadius: 10, padding: 12 },
  errorText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  googleSetupRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 12 },
  googleSetupText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#92400E" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: "#EEEEEE" },
  orText: { fontSize: 12, color: "#999", fontFamily: "Inter_400Regular" },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  inputWrapper: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", outlineWidth: 0 } as any,
  loginBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  loginBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  registerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  registerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  registerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});