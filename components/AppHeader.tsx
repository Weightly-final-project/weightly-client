import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
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
    <View style={styles.header}>
      <View style={styles.leftContainer}>
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
      </View>

      {showLogout && user && <LogoutButton variant="icon" />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 40 ,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  leftContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
});
