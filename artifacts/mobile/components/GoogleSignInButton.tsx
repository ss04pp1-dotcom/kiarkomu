import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "@/lib/config";
import { registerForPushNotificationsAsync } from "@/hooks/useNotifications";

interface Props {
  webClientId: string;
  androidClientId?: string | null;
  iosClientId?: string | null;
  onError: (msg: string) => void;
}

export function GoogleSignInButton({
  webClientId,
  androidClientId,
  iosClientId,
  onError,
}: Props) {
  const { setAuth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setLoading(true);

      // Configure with IDs fetched dynamically from the Admin Panel settings.
      // Called before each sign-in so admin changes take effect immediately.
      GoogleSignin.configure({
        webClientId,
        iosClientId: iosClientId ?? undefined,
        scopes: ["profile", "email"],
        offlineAccess: false,
      });

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const response = await GoogleSignin.signIn();

      if (!isSuccessResponse(response)) {
        // User dismissed the picker — not an error condition
        setLoading(false);
        return;
      }

      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error("No ID token received from Google.");
      }

      // Send idToken to backend for server-side verification
      const apiResponse = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(data.error || "Server authentication failed.");
      }

      await setAuth(data.user, data.token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Register push token in the background — do not block navigation
      registerForPushNotificationsAsync()
        .then((pushToken) => {
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
        .catch((e) =>
          console.log("[Google] Push registration failed:", e.message)
        );

      router.replace("/(tabs)");
    } catch (err: any) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          // User cancelled — no error message needed
        } else if (err.code === statusCodes.IN_PROGRESS) {
          onError("Sign-in is already in progress. Please wait.");
        } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          onError("Google Play Services is not available on this device.");
        } else {
          console.log("[Google] Error code:", err.code, err.message);
          onError(err.message || "Google Sign-In failed. Please try again.");
        }
      } else {
        console.log("[Google] Error:", err?.message);
        onError(err?.message || "Google Sign-In failed. Please try again.");
      }
    } finally {
      setLoading(false);
      // Sign out from the SDK so the account picker shows fresh next time
      GoogleSignin.signOut().catch(() => {});
    }
  };

  return (
    <Pressable
      style={[styles.btn, loading && { opacity: 0.7 }]}
      onPress={handleSignIn}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#E91E63" />
      ) : (
        <>
          <Image
            source={{ uri: "https://www.google.com/favicon.ico" }}
            style={styles.icon}
          />
          <Text style={styles.text}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    width: "100%",
  },
  icon: { width: 20, height: 20 },
  text: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#333" },
});
