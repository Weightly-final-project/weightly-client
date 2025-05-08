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

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSignIn = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please enter both username and password");
      return;
    }

    setIsLoading(true);
    try {
      await signIn(username, password);
      router.replace("/");
    } catch (error: any) {
      console.error("Sign in error:", error);

      // Show specific error messages based on error type
      if (error.name === "UserNotConfirmedException") {
        Alert.alert(
          "Account Not Verified",
          "Your account exists but has not been verified. Would you like to resend the verification code?",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Resend Code",
              onPress: () =>
                router.push({
                  pathname: "/signup",
                  params: { username, isConfirming: "true" },
                }),
            },
          ]
        );
      } else if (error.name === "NotAuthorizedException") {
        Alert.alert(
          "Invalid Credentials",
          "The username or password you entered is incorrect."
        );
      } else if (error.name === "UserNotFoundException") {
        Alert.alert(
          "User Not Found",
          "No account exists with this username. Would you like to sign up?",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Sign Up",
              onPress: () => router.push("/signup"),
            },
          ]
        );
      } else {
        Alert.alert(
          "Authentication Failed",
          error.message ||
            "Failed to sign in. Please check your credentials and try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToSignUp = () => {
    router.push("/signup");
  };

  const navigateToForgotPassword = () => {
    router.push("/forgot-password");
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#121212]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView className="flex-grow justify-center">
        <View className="px-6 py-10">
          <Text className="text-3xl font-bold text-white mb-2 text-center">Weightly</Text>
          <Text className="text-lg text-[#bbb] mb-8 text-center">Sign in to your account</Text>

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

          <View className="mb-5">
            <Text className="text-base text-white mb-2">Password</Text>
            <TextInput
              className="bg-[#2a2a2a] rounded-lg h-[50px] px-4 text-base text-white"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#666"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            className="self-end mb-6"
            onPress={navigateToForgotPassword}
          >
            <Text className="text-[#6200ee] text-sm">Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-[#6200ee] rounded-lg h-[50px] justify-center items-center mb-6"
            onPress={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-bold">Sign In</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row justify-center items-center">
            <Text className="text-[#bbb] text-sm mr-1">Don't have an account?</Text>
            <TouchableOpacity onPress={navigateToSignUp}>
              <Text className="text-[#6200ee] text-sm font-bold">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
