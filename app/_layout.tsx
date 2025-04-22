import React, { useEffect, useState } from "react";
import { Stack, SplashScreen } from "expo-router";
import { AuthProvider, useAuth } from "../utils/AuthContext";
import { View, ActivityIndicator, Text } from "react-native";
import { router, useSegments, useRootNavigationState } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Keep splash screen visible while we initialize
SplashScreen.preventAutoHideAsync();

// Create a client
const queryClient = new QueryClient();

// This component handles the initial routing based on auth state
function InitialLayout() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const segments = useSegments();
  const [appIsReady, setAppIsReady] = useState(false);
  const navigationState = useRootNavigationState();

  // For debugging - log auth state changes
  useEffect(() => {
    console.log("AUTH STATE CHANGED:", {
      isAuthenticated,
      user: user?.username,
      isLoading,
    });
  }, [isAuthenticated, user, isLoading]);

  // Only run the navigation effect when the navigationState is ready
  useEffect(() => {
    if (!navigationState?.key || isLoading) {
      return;
    }

    const prepare = async () => {
      try {
        // Wait for a moment to ensure everything is ready
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Now app is ready for navigation
        setAppIsReady(true);
      } catch (e) {
        console.warn("Error preparing app:", e);
      }
    };

    prepare();
  }, [navigationState, isLoading]);

  // Handle authentication state changes and navigate accordingly
  useEffect(() => {
    if (appIsReady) {
      // App is ready and we can safely navigate
      const inAuthGroup = segments[0] === "(auth)";

      console.log("NAVIGATION CHECK:", {
        isAuthenticated,
        inAuthGroup,
        segments: segments.join("/"),
      });

      if (!isAuthenticated && !inAuthGroup) {
        console.log("Not authenticated, safely navigating to login");
        router.replace("/(auth)/login");
      } else if (isAuthenticated && inAuthGroup) {
        console.log("Authenticated, safely navigating to home");
        router.replace("/");
      }

      // Hide splash screen now that we're ready
      SplashScreen.hideAsync();
    }
  }, [appIsReady, isAuthenticated, segments]);

  // This effect specifically watches for logout
  useEffect(() => {
    // If we were authenticated and now we're not, navigate to login
    if (!isLoading && !isAuthenticated && appIsReady) {
      console.log("DETECTED LOGOUT, forcing navigation to login");
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading, appIsReady]);

  // Show loading screen until app is ready
  if (isLoading || !appIsReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#121212",
        }}
      >
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={{ color: "#fff", marginTop: 16 }}>
          {isLoading ? "Checking authentication..." : "Preparing app..."}
        </Text>
      </View>
    );
  }

  // Once ready, just render children
  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#121212" },
          }}
        >
          <Stack.Screen
            name="(auth)/login"
            options={{
              title: "Login",
            }}
          />
          <Stack.Screen
            name="(auth)/signup"
            options={{
              title: "Sign Up",
            }}
          />
          <Stack.Screen
            name="index"
            options={{
              title: "Home",
            }}
          />
          <Stack.Screen
            name="camera"
            options={{
              title: "Camera",
            }}
          />
          <Stack.Screen
            name="prediction"
            options={{
              title: "Prediction",
            }}
          />
        </Stack>
        <InitialLayout />
      </AuthProvider>
    </QueryClientProvider>
  );
}
