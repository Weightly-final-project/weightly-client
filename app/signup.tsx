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

export default function SignupScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("+1"); // Pre-fill +1 for US
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const { signUp, confirmSignUp, resendConfirmationCode } = useAuth();
  const router = useRouter();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8; // Simple validation - at least 8 characters
  };

  const handleSignUp = async () => {
    if (!username || !email || !phoneNumber || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    if (!phoneNumber.startsWith("+")) {
      Alert.alert(
        "Error",
        "Phone number must start with + and country code (e.g. +1)"
      );
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert("Error", "Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      console.log("SIGNUP: Attempting to sign up user:", username);
      console.log("SIGNUP: Using email:", email);
      console.log("SIGNUP: Using phone:", phoneNumber);

      const result = await signUp(
        username,
        password,
        email,
        phoneNumber,
        "User"
      );
      console.log("SIGNUP SUCCESS:", result);

      setIsConfirming(true);
      Alert.alert(
        "Verification Required",
        "A verification code has been sent via SMS to your phone number. Please enter it to complete the registration."
      );
    } catch (error: any) {
      console.error("SIGNUP ERROR:", error);

      // Special handling for UserNotConfirmedException
      if (error.code === "UserNotConfirmedException") {
        console.log(
          "User exists but is not confirmed - moving to confirmation step"
        );
        setIsConfirming(true);
        Alert.alert(
          "Account Exists",
          "This account exists but has not been verified. Please check your email for a verification code."
        );
        return;
      }

      Alert.alert(
        "Registration Failed",
        error.message || "Failed to sign up. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    if (!verificationCode) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }

    setIsLoading(true);
    try {
      console.log("CONFIRM: Confirming signup for user:", username);
      console.log("CONFIRM: Using code:", verificationCode);

      const result = await confirmSignUp(username, verificationCode);
      console.log("CONFIRM SUCCESS:", result);

      Alert.alert(
        "Success",
        "Your account has been verified! You can now sign in.",
        [
          {
            text: "Sign In",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]
      );
    } catch (error: any) {
      console.error("CONFIRM ERROR:", error);
      Alert.alert(
        "Verification Failed",
        error.message || "Failed to verify account. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!username) {
      Alert.alert("Error", "Username is required to resend code");
      return;
    }

    try {
      console.log("RESEND: Requesting new code for user:", username);
      const result = await resendConfirmationCode(username);
      console.log("RESEND SUCCESS:", result);

      Alert.alert(
        "Success",
        "A new verification code has been sent to your email."
      );
    } catch (error: any) {
      console.error("RESEND ERROR:", error);
      Alert.alert(
        "Failed to Resend Code",
        error.message || "Failed to resend verification code. Please try again."
      );
    }
  };

  const navigateToSignIn = () => {
    router.replace("/(auth)/login");
  };

  if (isConfirming) {
    return (
      <View className="flex-1 bg-[#121212]">
        <View className="px-6 py-10">
          <Text className="text-2xl font-bold text-white mb-2 text-center">
            Verify Your Account
          </Text>
          <Text className="text-lg text-[#bbb] mb-8 text-center">
            Enter the verification code sent to your phone
          </Text>

          <View className="mb-5">
            <Text className="text-base text-white mb-2">Verification Code</Text>
            <TextInput
              className="bg-[#2a2a2a] rounded-lg h-[50px] px-4 text-base text-white"
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="Enter verification code"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              autoFocus={true}
            />
          </View>

          <TouchableOpacity
            className="bg-[#6200ee] rounded-lg h-[50px] justify-center items-center mb-6"
            onPress={handleConfirmSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-bold">
                Verify Account
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="justify-center items-center mb-6"
            onPress={handleResendCode}
          >
            <Text className="text-[#6200ee] text-sm">Resend verification code</Text>
          </TouchableOpacity>

          <View className="bg-[#424242]/50 rounded-lg p-3 mb-6">
            <Text className="text-[#ddd] text-sm text-center">
              The verification code is sent via SMS to your phone number (
              {phoneNumber}). It may take a few moments to arrive.
            </Text>
          </View>

          <TouchableOpacity
            className="bg-[#ff9800] rounded-lg h-[50px] justify-center items-center mt-4"
            onPress={() => {
              Alert.alert(
                "Development Only",
                "In a production environment, verification is required. For development, you can proceed to login.",
                [
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                  {
                    text: "Go to Login",
                    onPress: () => router.replace("/(auth)/login"),
                  },
                ]
              );
            }}
          >
            <Text className="text-white text-base font-bold">
              Skip Verification (Dev Only)
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#121212]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView className="flex-grow justify-center">
        <View className="px-6 py-10">
          <Text className="text-3xl font-bold text-white mb-2 text-center">
            Create Account
          </Text>
          <Text className="text-lg text-[#bbb] mb-8 text-center">
            Sign up to get started
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

          <View className="mb-5">
            <Text className="text-base text-white mb-2">Email</Text>
            <TextInput
              className="bg-[#2a2a2a] rounded-lg h-[50px] px-4 text-base text-white"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#666"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View className="mb-5">
            <Text className="text-base text-white mb-2">Phone Number</Text>
            <TextInput
              className="bg-[#2a2a2a] rounded-lg h-[50px] px-4 text-base text-white"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+1 (with country code)"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
            />
            <Text className="text-[#bbb] text-xs mt-1">
              Include country code (e.g., +1 for US). A verification code will
              be sent here.
            </Text>
          </View>

          <View className="mb-5">
            <Text className="text-base text-white mb-2">Password</Text>
            <TextInput
              className="bg-[#2a2a2a] rounded-lg h-[50px] px-4 text-base text-white"
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              placeholderTextColor="#666"
              secureTextEntry
            />
          </View>

          <View className="mb-5">
            <Text className="text-base text-white mb-2">Confirm Password</Text>
            <TextInput
              className="bg-[#2a2a2a] rounded-lg h-[50px] px-4 text-base text-white"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              placeholderTextColor="#666"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            className="bg-[#6200ee] rounded-lg h-[50px] justify-center items-center mb-6"
            onPress={handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-bold">Sign Up</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row justify-center items-center">
            <Text className="text-[#bbb] text-sm mr-1">
              Already have an account?
            </Text>
            <TouchableOpacity onPress={navigateToSignIn}>
              <Text className="text-[#6200ee] text-sm font-bold">Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
