import React from "react";
import { TouchableOpacity, Text, StyleSheet, Alert } from "react-native";
import { useAuth } from "../utils/AuthContext";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type LogoutButtonProps = {
  variant?: "icon" | "text" | "full";
  style?: object;
};

export default function LogoutButton({
  variant = "full",
  style,
}: LogoutButtonProps) {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        onPress: async () => {
          try {
            console.log("LOGOUT: Starting logout process");

            // First sign out from the auth system
            await signOut();

            console.log("LOGOUT: Sign out complete, forcing navigation");

            // Force a hard navigation reset to the login screen
            router.navigate({
              pathname: "/(auth)/login",
              params: {
                reset: Date.now().toString(), // Force a fresh load
              },
            });

            // Try another approach as backup
            setTimeout(() => {
              console.log("LOGOUT: Backup navigation triggered");
              router.replace("/(auth)/login");
            }, 500);
          } catch (error) {
            console.error("LOGOUT ERROR:", error);
            Alert.alert("Error", "Failed to sign out. Please try again.");
          }
        },
      },
    ]);
  };

  if (variant === "icon") {
    return (
      <TouchableOpacity
        style={[styles.iconButton, style]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={24} color="#fff" />
      </TouchableOpacity>
    );
  }

  if (variant === "text") {
    return (
      <TouchableOpacity
        style={[styles.textButton, style]}
        onPress={handleLogout}
      >
        <Text style={styles.textButtonText}>Logout</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.button, style]} onPress={handleLogout}>
      <Ionicons
        name="log-out-outline"
        size={20}
        color="#fff"
        style={styles.icon}
      />
      <Text style={styles.buttonText}>Logout</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#d32f2f",
    borderRadius: 8,
    height: 45,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  icon: {
    marginRight: 8,
  },
  iconButton: {
    padding: 8,
  },
  textButton: {
    padding: 8,
  },
  textButtonText: {
    color: "#d32f2f",
    fontSize: 16,
    fontWeight: "bold",
  },
});
