import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../utils/AuthContext";

export default function ForgotPasswordScreen() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetRequested, setIsResetRequested] = useState(false);

  const { forgotPassword, forgotPasswordSubmit } = useAuth();
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!username) {
      Alert.alert("Error", "Please enter your username");
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword(username);
      setIsResetRequested(true);
      Alert.alert(
        "Code Sent",
        "A verification code has been sent to your email. Please use it to reset your password."
      );
    } catch (error: any) {
      console.error("Password reset error:", error);
      Alert.alert(
        "Error Requesting Reset",
        error.message || "Failed to request password reset. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitNewPassword = async () => {
    if (!code || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);
    try {
      await forgotPasswordSubmit(username, code, newPassword);
      Alert.alert(
        "Success",
        "Your password has been reset successfully. You can now sign in with your new password.",
        [
          {
            text: "Sign In",
            onPress: () => router.push("/login"),
          },
        ]
      );
    } catch (error: any) {
      console.error("Submit new password error:", error);
      Alert.alert(
        "Password Reset Failed",
        error.message || "Failed to reset password. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#121212]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView className="flex-grow justify-center">
        <View className="px-6 py-10">
          <Text className="text-3xl font-bold text-white mb-2 text-center">Reset Password</Text>

          {!isResetRequested ? (
            <>
              <Text className="text-base text-[#bbb] mb-8 text-center">
                Enter your username and we'll send you a code to reset your password
              </Text>

              <View className="mb-5">
                <Text className="text-base text-white mb-2">Username</Text>
                <TextInput
                  className="bg-[#2a2a2a] rounded-lg h-[50px] px-4 text-base text-white"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter your username"
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                className="bg-[#6200ee] rounded-lg h-[50px] justify-center items-center mb-6"
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-base font-bold">Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="text-base text-[#bbb] mb-8 text-center">
                Enter the verification code sent to your email and create a new password
              </Text>

              <View className="mb-5">
                <Text className="text-base text-white mb-2">Verification Code</Text>
                <TextInput
                  className="bg-[#2a2a2a] rounded-lg h-[50px] px-4 text-base text-white"
                  value={code}
                  onChangeText={setCode}
                  placeholder="Enter verification code"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                />
              </View>

              <View className="mb-5">
                <Text className="text-base text-white mb-2">New Password</Text>
                <TextInput
                  className="bg-[#2a2a2a] rounded-lg h-[50px] px-4 text-base text-white"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Create a new password"
                  placeholderTextColor="#666"
                  secureTextEntry
                />
              </View>

              <View className="mb-5">
                <Text className="text-base text-white mb-2">Confirm New Password</Text>
                <TextInput
                  className="bg-[#2a2a2a] rounded-lg h-[50px] px-4 text-base text-white"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your new password"
                  placeholderTextColor="#666"
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                className="bg-[#6200ee] rounded-lg h-[50px] justify-center items-center mb-6"
                onPress={handleSubmitNewPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-base font-bold">Reset Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity className="items-center" onPress={goBack}>
            <Text className="text-[#6200ee] text-sm">Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
