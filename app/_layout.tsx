import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { Stack, SplashScreen, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../utils/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// keep splash on until we call hideAsync
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { isLoading, isAuthenticated } = useAuth();
  const [appReady, setAppReady] = useState(false);

  // 1) Wait for auth to load, then hide splash and mark ready
  useEffect(() => {
    if (isLoading) return;
    (async () => {
      await SplashScreen.hideAsync();
      setAppReady(true);
    })();
  }, [isLoading]);

  // 2) Once ready, perform redirect logic
  useEffect(() => {
    if (!appReady) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/");
    }
  }, [appReady, isAuthenticated, segments, router]);

  // 3) Show loading indicator until we’re fully ready
  if (isLoading || !appReady) {
    return (
      <View style={{ flex: 1, backgroundColor: "#121212", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={{ color: "#fff", marginTop: 12 }}>
          {isLoading ? "Checking authentication…" : "Preparing app…"}
        </Text>
      </View>
    );
  }

  // 4) Now that we’re ready, render your Stack
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#121212" },
      }}
    >
      <Stack.Screen name="(auth)/login" options={{ title: "Login" }} />
      <Stack.Screen name="(auth)/signup" options={{ title: "Sign Up" }} />
      <Stack.Screen name="index" options={{ title: "Home" }} />
      <Stack.Screen name="camera" options={{ title: "Camera" }} />
      <Stack.Screen name="prediction" options={{ title: "Prediction" }} />
    </Stack>
  );
}
