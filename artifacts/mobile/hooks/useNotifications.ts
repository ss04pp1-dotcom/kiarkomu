import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { API_BASE_URL } from "@/lib/config";

const isExpoGo = Constants.appOwnership === "expo";

if (Platform.OS !== "web" && !isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function resolveProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web" || isExpoGo) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("[Push] Notification permission not granted");
      return null;
    }

    const projectId = resolveProjectId();
    if (!projectId) {
      console.warn(
        "[Push] projectId is undefined. Make sure extra.eas.projectId is set in app.json " +
        "and the app was built with EAS Build (not Expo Go)."
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err) {
    console.warn("[Push] Failed to get Expo push token:", err);
    return null;
  }
}

async function savePushTokenToServer(pushToken: string, authToken: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pushToken }),
    });
  } catch {
    // silently ignore — will retry on next session
  }
}

export function useNotificationSetup(isAuthenticated: boolean, authToken: string | null) {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const tokenSaved = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web" || isExpoGo) return;

    if (isAuthenticated && authToken && !tokenSaved.current) {
      tokenSaved.current = true;
      registerForPushNotificationsAsync()
        .then(pushToken => {
          if (pushToken) savePushTokenToServer(pushToken, authToken);
        })
        .catch(() => {});
    }

    notificationListener.current = Notifications.addNotificationReceivedListener(_notification => {
      // The OS banner handles foreground notification display — no in-app alert needed.
    });
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.orderId) router.push(`/order/${data.orderId}` as any);
      else if (data?.url) router.push(data.url as any);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated, authToken]);
}
