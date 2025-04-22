import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
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
      <View style={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Verify Your Account</Text>
          <Text style={styles.subtitle}>
            Enter the verification code sent to your phone
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={styles.input}
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="Enter verification code"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              autoFocus={true}
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleConfirmSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleResendCode}
          >
            <Text style={styles.linkText}>Resend verification code</Text>
          </TouchableOpacity>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              The verification code is sent via SMS to your phone number (
              {phoneNumber}). It may take a few moments to arrive.
            </Text>
          </View>

          {/* Development-only button to skip verification */}
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: "#ff9800", marginTop: 16 },
            ]}
            onPress={() => {
              // For development only - skip verification
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
            <Text style={styles.buttonText}>Skip Verification (Dev Only)</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              placeholderTextColor="#666"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#666"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Phone Number{" "}
              <Text style={styles.labelHighlight}>
                (Required for Verification)
              </Text>
            </Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+1 (with country code)"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
            />
            <Text style={styles.helperText}>
              Include country code (e.g., +1 for US). A verification code will
              be sent here.
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              placeholderTextColor="#666"
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              placeholderTextColor="#666"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account?</Text>
            <TouchableOpacity onPress={navigateToSignIn}>
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  formContainer: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#bbb",
    marginBottom: 32,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#fff",
  },
  button: {
    backgroundColor: "#6200ee",
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signInText: {
    color: "#bbb",
    fontSize: 14,
    marginRight: 4,
  },
  signInLink: {
    color: "#6200ee",
    fontSize: 14,
    fontWeight: "bold",
  },
  linkButton: {
    alignItems: "center",
    marginBottom: 24,
  },
  linkText: {
    color: "#6200ee",
    fontSize: 14,
  },
  infoContainer: {
    backgroundColor: "rgba(66, 66, 66, 0.5)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  infoText: {
    color: "#ddd",
    fontSize: 14,
    textAlign: "center",
  },
  helperText: {
    color: "#bbb",
    fontSize: 12,
    marginTop: 4,
  },
  labelHighlight: {
    color: "#ff9800",
    fontWeight: "bold",
    fontSize: 14,
  },
});
