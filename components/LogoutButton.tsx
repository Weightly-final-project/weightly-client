import React from "react";
import { TouchableOpacity, Text, Alert } from "react-native";
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
        className="p-2"
        style={style}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={24} color="#fff" />
      </TouchableOpacity>
    );
  }

  if (variant === "text") {
    return (
      <TouchableOpacity
        className="p-2"
        style={style}
        onPress={handleLogout}
      >
        <Text className="text-[#d32f2f] text-base font-bold">Logout</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      className="bg-[#d32f2f] rounded-lg h-[45px] px-4 flex-row justify-center items-center"
      style={style} 
      onPress={handleLogout}
    >
      <Ionicons
        name="log-out-outline"
        size={20}
        color="#fff"
        className="mr-2"
      />
      <Text className="text-white text-base font-bold">Logout</Text>
    </TouchableOpacity>
  );
}
