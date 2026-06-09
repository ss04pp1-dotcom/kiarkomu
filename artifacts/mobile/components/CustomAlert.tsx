import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";

const PINK = "#E91E63";

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
}

export default function CustomAlert({ visible, title, message, buttons = [{ text: "OK" }], onDismiss }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={[styles.btnRow, buttons.length === 1 && { justifyContent: "center" }]}>
            {buttons.map((btn, i) => {
              const isCancel = btn.style === "cancel";
              const isDestructive = btn.style === "destructive";
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.btn,
                    buttons.length > 1 && { flex: 1 },
                    isCancel ? styles.btnCancel : isDestructive ? styles.btnDestructive : styles.btnPrimary,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => { btn.onPress?.(); onDismiss?.(); }}
                >
                  <Text style={[styles.btnText, isCancel && styles.btnCancelText]}>
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#555555",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 22,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  btn: {
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90,
  },
  btnPrimary: { backgroundColor: PINK },
  btnDestructive: { backgroundColor: "#EF4444" },
  btnCancel: { backgroundColor: "#F3F4F6" },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  btnCancelText: { color: "#374151" },
});
