import React, { createContext, useState, useContext, useEffect } from "react";
import Auth from "@aws-amplify/auth";
import { Hub } from "aws-amplify";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Configure Amplify with real Cognito credentials from .env
console.log("============ AUTH CONFIGURATION ============");
console.log("User Pool ID:", process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID);
console.log("Client ID:", process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID);

// Format AWS configuration object properly for Amplify v5
const awsConfig = {
  Auth: {
    region: "eu-west-1",
    userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID,
    userPoolWebClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID,
    mandatorySignIn: true,
  },
};

console.log("Using AWS config:", JSON.stringify(awsConfig, null, 2));

Auth.configure(awsConfig);

// We're now using real authentication

type AuthContextType = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: any;
  signIn: (username: string, password: string) => Promise<any>;
  signUp: (
    username: string,
    password: string,
    email: string,
    phoneNumber: string,
    familyName: string
  ) => Promise<any>;
  confirmSignUp: (username: string, code: string) => Promise<any>;
  resendConfirmationCode: (username: string) => Promise<any>;
  signOut: () => Promise<void>;
  forgotPassword: (username: string) => Promise<any>;
  forgotPasswordSubmit: (
    username: string,
    code: string,
    newPassword: string
  ) => Promise<any>;
  devBypassLogin: (username: string) => Promise<any>;
};

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
  signIn: async () => {},
  signUp: async () => {},
  confirmSignUp: async () => {},
  resendConfirmationCode: async () => {},
  signOut: async () => {},
  forgotPassword: async () => {},
  forgotPasswordSubmit: async () => {},
  devBypassLogin: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check if user is already authenticated
    checkAuthState();

    // Listen for auth events - updated to match Amplify v5 event names
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      console.log(`Auth event: ${payload.event}`);

      switch (payload.event) {
        case "signIn":
          checkAuthState();
          break;
        case "signOut":
          setUser(null);
          setIsAuthenticated(false);
          break;
        case "signIn_failure":
          console.log("Sign in failure", payload);
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  const checkAuthState = async () => {
    setIsLoading(true);
    try {
      console.log("Checking auth state...");
      const user = await Auth.currentAuthenticatedUser();
      console.log("User is authenticated:", user.username);
      setIsAuthenticated(true);
      setUser(user);
    } catch (error) {
      console.log("User is not authenticated");
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      console.log("Attempting sign in...");
      const result = await Auth.signIn(username, password);
      console.log("Sign in successful", result);

      // Update auth state immediately after successful login
      setIsAuthenticated(true);
      setUser(result);

      return result;
    } catch (error) {
      console.log("Error signing in:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    username: string,
    password: string,
    email: string,
    phoneNumber: string,
    familyName: string
  ): Promise<any> => {
    try {
      console.log("AUTH: Starting signup process for:", username);
      console.log("AUTH: Using email:", email);
      console.log("AUTH: Using phone:", phoneNumber);

      const result = await Auth.signUp({
        username,
        password,
        attributes: {
          email,
          phone_number: phoneNumber,
          family_name: familyName,
          name: username,
        },
      });

      console.log("AUTH: Signup successful:", JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error("AUTH: Error signing up:", error);
      throw error;
    }
  };

  const confirmSignUp = async (
    username: string,
    code: string
  ): Promise<any> => {
    try {
      console.log("AUTH: Confirming signup for:", username);
      console.log("AUTH: Using code:", code);

      const result = await Auth.confirmSignUp(username, code);
      console.log(
        "AUTH: Confirmation successful:",
        JSON.stringify(result, null, 2)
      );
      return result;
    } catch (error) {
      console.error("AUTH: Error confirming sign up:", error);
      throw error;
    }
  };

  const resendConfirmationCode = async (username: string): Promise<any> => {
    try {
      console.log("AUTH: Resending confirmation code for:", username);

      const result = await Auth.resendSignUp(username);
      console.log(
        "AUTH: Code resent successfully:",
        JSON.stringify(result, null, 2)
      );
      return result;
    } catch (error) {
      console.error("AUTH: Error resending code:", error);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      console.log("AUTH: Starting sign out process");

      // Sign out from AWS Amplify
      await Auth.signOut();

      // Explicitly reset the authentication state
      setUser(null);
      setIsAuthenticated(false);

      console.log("AUTH: Sign out complete, auth state reset");
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const forgotPassword = async (username: string): Promise<any> => {
    try {
      return await Auth.forgotPassword(username);
    } catch (error) {
      console.error("Error resetting password:", error);
      throw error;
    }
  };

  const forgotPasswordSubmit = async (
    username: string,
    code: string,
    newPassword: string
  ): Promise<any> => {
    try {
      return await Auth.forgotPasswordSubmit(username, code, newPassword);
    } catch (error) {
      console.error("Error submitting new password:", error);
      throw error;
    }
  };

  const devBypassLogin = async (username: string): Promise<any> => {
    console.log("DEVELOPMENT ONLY: Bypassing normal login for:", username);

    // Set user state manually for development
    setUser({ username });
    setIsAuthenticated(true);

    return { isSignedIn: true };
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        user,
        signIn,
        signUp,
        confirmSignUp,
        resendConfirmationCode,
        signOut,
        forgotPassword,
        forgotPasswordSubmit,
        devBypassLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
