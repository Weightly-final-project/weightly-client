import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { Stack, SplashScreen, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../utils/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";

// keep splash on until we call hideAsync
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { isLoading, isAuthenticated } = useAuth();
  const [appReady, setAppReady] = useState(false);
  const [lastNavigation, setLastNavigation] = useState("");

  // 1) Wait for auth to load, then hide splash and mark ready
  useEffect(() => {
    if (isLoading) return;
    (async () => {
      await SplashScreen.hideAsync();
      setAppReady(true);
    })();
  }, [isLoading]);

  // 2) Handle routing once auth state is loaded and app is ready
  useEffect(() => {
    // Don't do anything until app is ready and auth state is loaded
    if (!appReady || isLoading) return;
    
    // Get the current path
    const currentSegment = segments[0];
    const navKey = `${isAuthenticated}-${currentSegment}`;
    
    // Skip if we've already processed this exact navigation state
    if (navKey === lastNavigation) return;
    
    console.log("App navigator: routing check - authenticated:", isAuthenticated, "path:", currentSegment);
    
    // Auth screens
    const authScreens = ["login", "signup", "forgot-password"];
    const isAuthScreen = authScreens.includes(currentSegment || "");
    
    // Determine if we need to redirect
    if (!isAuthenticated && !isAuthScreen) {
      console.log("Not authenticated and not on auth screen, redirecting to login");
      setLastNavigation(navKey);
      router.replace("/login");
    } else if (isAuthenticated && isAuthScreen) {
      console.log("Authenticated but on auth screen, redirecting to home");
      setLastNavigation(navKey);
      router.replace("/");
    } else {
      // No navigation needed, but update the last navigation to prevent rechecking
      setLastNavigation(navKey);
    }
  }, [appReady, isLoading, isAuthenticated, segments, router, lastNavigation]);

  // 3) Show loading indicator until we're fully ready
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

  // 4) Now that we're ready, render your Stack
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
