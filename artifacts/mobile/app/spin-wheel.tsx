import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { useSpinWheel, useGetSpinStatus, getGetSpinStatusQueryKey } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useAlert } from "@/contexts/AlertContext";

const { width } = Dimensions.get("window");
const WHEEL_SIZE = width * 0.75;
const R = WHEEL_SIZE / 2;
const W = R * 0.57735; // 60 degree slice width calculation

const SEGMENTS =["50\nCoins", "10\nCoins", "Try\nAgain", "100\nCoins", "20\nCoins", "Try\nAgain"];
const SEG_COLORS =["#FF3366", "#FF9933", "#9933FF", "#00CC99", "#3399FF", "#FFCC00"];

export default function SpinWheelScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const { showAlert } = useAlert();
  const { data: spinStatus } = useGetSpinStatus({ query: { queryKey: getGetSpinStatusQueryKey() } });
  const spinMutation = useSpinWheel();

  const handleSpin = () => {
    if (!spinStatus?.canSpin || spinning) return;
    setSpinning(true);
    setResult(null);
    scaleAnim.setValue(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // ── FIX: Fetch server result FIRST, then animate to the correct prize ──
    // This ensures the wheel visually lands on exactly what the server decided.
    spinMutation.mutate(undefined, {
      onSuccess: (res: any) => {
        setResult(res);

        // Map server response to segment index
        // The API returns coinsWon: 0 for "Try Again", otherwise the coins amount
        const coinsWon = res.coinsWon ?? 0;
        let segmentIndex = 2; // default: first "Try Again"
        if (coinsWon === 50) segmentIndex = 0;
        else if (coinsWon === 10) segmentIndex = 1;
        else if (coinsWon === 100) segmentIndex = 3;
        else if (coinsWon === 20) segmentIndex = 4;
        else if (coinsWon === 0) segmentIndex = res.segmentIndex ?? 2;

        // Each segment is 60 degrees. We spin N full rotations + land on target segment.
        // The wheel pointer is at the top (0 deg). Segment 0 starts at 0 deg.
        // To land segment `i` under the pointer: rotate by -(i * 60) + offset to center it.
        const segmentDegrees = segmentIndex * 60;
        const centerOffset = 30; // center of segment
        const fullSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations for drama
        const targetDegrees = fullSpins * 360 + (360 - segmentDegrees + centerOffset);
        const targetRotations = targetDegrees / 360;

        // Get current spinAnim value and compute from it to maintain continuity
        spinAnim.setValue(0);
        Animated.timing(spinAnim, {
          toValue: targetRotations,
          duration: 4000,
          easing: (t) => {
            // Ease out cubic — fast start, slow finish
            return 1 - Math.pow(1 - t, 3);
          },
          useNativeDriver: true,
        }).start(() => {
          setSpinning(false);
          queryClient.invalidateQueries({ queryKey: getGetSpinStatusQueryKey() });
          Haptics.notificationAsync(
            coinsWon > 0
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning
          );
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
          }).start();
        });
      },
      onError: () => {
        setSpinning(false);
        showAlert({ title: "Oops!", message: "You have already spun today!" });
      },
    });
  };

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
    extrapolate: "extend",
  });

  const renderDots = () => {
    return Array.from({ length: 12 }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.dotWrapper,
          { transform: [{ rotate: `${i * 30}deg` }] }
        ]}
      >
        <View style={styles.dot} />
      </View>
    ));
  };

  return (
    <LinearGradient colors={["#1A0B2E", "#3B185F", "#1A0B2E"]} style={styles.container}>
      
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.title}>Spin & Win</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>Test your luck today!</Text>
          <Text style={styles.subText}>Spin the wheel to win exciting rewards</Text>
        </View>

        <View style={styles.wheelContainer}>
          <View style={styles.pointerShadow} />
          <View style={styles.pointer} />

          <View style={styles.wheelOuterRim}>
            {renderDots()}
            
            <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
              
              {SEGMENTS.map((_, i) => (
                <View
                  key={`wedge-${i}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: R - W,
                    width: 0,
                    height: 0,
                    borderLeftWidth: W,
                    borderRightWidth: W,
                    borderTopWidth: R,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderTopColor: SEG_COLORS[i],
                    transform:[
                      { translateY: R / 2 },
                      { rotate: `${i * 60}deg` },
                      { translateY: -R / 2 }
                    ]
                  }}
                />
              ))}

              {SEGMENTS.map((seg, i) => (
                <View
                  key={`text-${i}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: WHEEL_SIZE,
                    height: WHEEL_SIZE,
                    alignItems: "center",
                    transform: [{ rotate: `${i * 60}deg` }],
                    zIndex: 2,
                  }}
                >
                  <Text style={styles.segText}>{seg}</Text>
                </View>
              ))}

            </Animated.View>
            
            <View style={styles.centerKnobOuter}>
              <View style={styles.centerKnobInner}>
                <Text style={styles.centerText}>SPIN</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bottomSection}>
          {result ? (
            <Animated.View style={[styles.resultWrapper, { transform: [{ scale: scaleAnim }] }]}>
              <LinearGradient
                colors={result.coinsWon > 0 ?["#00C9FF", "#92FE9D"] : ["#FF416C", "#FF4B2B"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.resultBox}
              >
                <FontAwesome5 
                  name={result.coinsWon > 0 ? "coins" : "sad-tear"} 
                  size={24} 
                  color="#FFF" 
                  style={{ marginBottom: 8 }} 
                />
                <Text style={styles.resultTitle}>
                  {result.coinsWon > 0 ? `Congratulations!` : `Better Luck Next Time`}
                </Text>
                <Text style={styles.resultDesc}>
                  {result.coinsWon > 0 ? `You won ${result.coinsWon} coins` : result.prize}
                </Text>
              </LinearGradient>
            </Animated.View>
          ) : (
            <View style={styles.placeholderBox} />
          )}

          <Pressable
            style={({ pressed }) =>[
              styles.spinBtnWrapper,
              (!spinStatus?.canSpin || spinning) && styles.spinBtnDisabled,
              pressed && spinStatus?.canSpin && !spinning && { transform:[{ scale: 0.96 }] }
            ]}
            onPress={handleSpin}
            disabled={!spinStatus?.canSpin || spinning}
          >
            <LinearGradient
              colors={spinStatus?.canSpin && !spinning ?["#FF416C", "#FF4B2B"] :["#555", "#333"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.spinBtn}
            >
              <Text style={styles.spinBtnText}>
                {spinning ? "Spinning..." : spinStatus?.canSpin ? "SPIN NOW" : "COME BACK TOMORROW"}
              </Text>
            </LinearGradient>
          </Pressable>

          {!spinStatus?.canSpin && spinStatus?.nextSpinAt && (
            <View style={styles.timerBadge}>
              <Feather name="clock" size={14} color="#FFD700" />
              <Text style={styles.nextSpin}>
                Next spin: {new Date(spinStatus.nextSpinAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center"
  },
  title: { 
    fontSize: 22, 
    fontFamily: "Inter_700Bold", 
    color: "#FFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4
  },
  content: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingVertical: 20 
  },
  subtitleContainer: { alignItems: "center", gap: 4 },
  subtitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFD700" },
  subText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  
  wheelContainer: { 
    alignItems: "center", 
    justifyContent: "center", 
    marginVertical: 30,
    position: "relative"
  },
  pointerShadow: {
    position: "absolute",
    top: -22,
    zIndex: 9,
    width: 0, height: 0,
    borderLeftWidth: 18, borderRightWidth: 18, borderTopWidth: 35,
    borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "rgba(0,0,0,0.4)",
  },
  pointer: { 
    position: "absolute", 
    top: -25, 
    zIndex: 10, 
    width: 0, height: 0, 
    borderLeftWidth: 15, borderRightWidth: 15, borderTopWidth: 30, 
    borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#FFD700",
  },
  wheelOuterRim: {
    width: WHEEL_SIZE + 24,
    height: WHEEL_SIZE + 24,
    borderRadius: (WHEEL_SIZE + 24) / 2,
    backgroundColor: "#2A0845",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFD700",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  dotWrapper: {
    position: "absolute",
    width: 10, height: WHEEL_SIZE + 12,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  dot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: "#FFF",
    shadowColor: "#FFF",
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  wheel: { 
    width: WHEEL_SIZE, 
    height: WHEEL_SIZE, 
    borderRadius: WHEEL_SIZE / 2, 
    overflow: "hidden", 
    position: "relative",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)"
  },
  segment: { 
    position: "absolute", 
    width: "50%", height: "50%", 
    transformOrigin: "100% 100%", 
    alignItems: "center", 
    paddingTop: 20,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.3)"
  },
  segText: { 
    color: "#FFF", 
    fontSize: 12, 
    fontFamily: "Inter_700Bold", 
    transform: [{ rotate: "30deg" }],
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: 10
  },
  centerKnobOuter: {
    position: "absolute",
    width: 70, height: 70,
    borderRadius: 35,
    backgroundColor: "#FFD700",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 5, elevation: 6
  },
  centerKnobInner: {
    width: 54, height: 54,
    borderRadius: 27,
    backgroundColor: "#FFF",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#EEE"
  },
  centerText: { 
    fontSize: 14, 
    fontFamily: "Inter_700Bold", 
    color: "#E91E63" 
  },

  bottomSection: { width: "100%", alignItems: "center", paddingHorizontal: 24, gap: 20 },
  placeholderBox: { height: 80 },
  resultWrapper: { width: "100%", alignItems: "center" },
  resultBox: { 
    width: "100%",
    borderRadius: 16, 
    padding: 20, 
    alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 8
  },
  resultTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 4 },
  resultDesc: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.9)" },
  
  spinBtnWrapper: { width: "100%", borderRadius: 30, overflow: "hidden", shadowColor: "#FF416C", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  spinBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  spinBtn: { paddingVertical: 18, alignItems: "center", justifyContent: "center" },
  spinBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF", letterSpacing: 1 },
  
  timerBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  nextSpin: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#FFD700" },
});