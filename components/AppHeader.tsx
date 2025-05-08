import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import LogoutButton from "./LogoutButton";
import { useAuth } from "../utils/AuthContext";

type AppHeaderProps = {
  title: string;
  showBack?: boolean;
  showLogout?: boolean;
};

export default function AppHeader({
  title,
  showBack = false,
  showLogout = true,
}: AppHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View className={`flex-row items-center justify-between px-4 bg-[#121212] border-b border-[#2a2a2a] ${Platform.OS === "ios" ? "h-[90px] pt-10" : "h-[60px]"}`}>
      <View className="flex-row items-center">
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
        )}
        <Text className="text-xl font-bold text-white">{title}</Text>
      </View>

      {showLogout && user && <LogoutButton variant="icon" />}
    </View>
  );
}
