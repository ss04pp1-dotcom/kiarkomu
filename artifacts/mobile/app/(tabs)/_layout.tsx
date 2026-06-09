import { Tabs } from "expo-router";
import React from "react";

// Base URL override is handled in app/_layout.tsx (root layout).
// No duplicate fetch override needed here.

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="categories" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="cart" />
    </Tabs>
  );
}
