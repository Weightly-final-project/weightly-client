import React, { createContext, useState, useContext, useEffect } from "react";
import * as AmplifyAuth from '@aws-amplify/auth';
import type { AuthUser, AuthFlowType } from '@aws-amplify/auth';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureAmplify } from './amplifyConfig';

// Configure Amplify
configureAmplify();

type AuthContextType = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  signIn: (username: string, password: string) => Promise<any>;
  signUp: (
    username: string,
    password: string,
    email: string,
    phoneNumber: string,
    familyName: string
  ) => Promise<any>;
  confirmSignUp: (username: string, code: string) => Promise<any>;
  verifyCode: (username: string, code: string) => Promise<any>;
  resendConfirmationCode: (username: string) => Promise<any>;
  signOut: () => Promise<void>;
  forgotPassword: (username: string) => Promise<any>;
  forgotPasswordSubmit: (
    username: string,
    code: string,
    newPassword: string
  ) => Promise<void>;
  devBypassLogin: (username: string) => Promise<{ isSignedIn: boolean }>;
};

const defaultContext: AuthContextType = {
  isLoading: false,
  isAuthenticated: false,
  user: null,
  signIn: () => throwError(),
  signUp: () => throwError(),
  confirmSignUp: () => throwError(),
  verifyCode: () => throwError(),
  resendConfirmationCode: () => throwError(),
  signOut: () => throwError(),
  forgotPassword: () => throwError(),
  forgotPasswordSubmit: () => throwError(),
  devBypassLogin: () => throwError(),
};

const AuthContext = createContext<AuthContextType>(defaultContext);

const throwError = () => {
  throw new Error('Cannot use auth context outside of AuthProvider');
};

// Add debug logging for auth operations
const debugLog = (message: string, ...args: any[]) => {
  console.log(`[Auth Debug] ${message}`, ...args);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    setIsLoading(true);
    try {
      const currentUser = await AmplifyAuth.getCurrentUser();
      if (currentUser) {
        debugLog('Valid session found');
        setIsAuthenticated(true);
        setUser(currentUser);
      }
    } catch (error) {
      debugLog('No current user or session invalid:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (username: string, password: string): Promise<any> => {
    setIsLoading(true);
    
    try {
      debugLog('=== Starting Sign In Process ===');
      debugLog('Attempting sign in for username:', username);
      
      // Clear any existing sessions first
      try {
        await AmplifyAuth.signOut();
        debugLog('Cleared existing session');
      } catch (signOutError) {
        debugLog('No existing session to clear');
      }
      
      // Attempt sign in with username and password
      const signInResult = await AmplifyAuth.signIn({
        username,
        password,
        options: {
          // @ts-ignore - type is not exported but is supported
          authFlowType: "USER_PASSWORD_AUTH"
        }
      });
      
      debugLog('Sign in attempt result:', {
        isSignedIn: signInResult.isSignedIn,
        nextStep: signInResult.nextStep
      });

      if (signInResult.isSignedIn) {
        const currentUser = await AmplifyAuth.getCurrentUser();
        debugLog('Successfully signed in user:', currentUser);
        
        setUser(currentUser);
        setIsAuthenticated(true);
        
        try {
          await AsyncStorage.setItem('authenticated', 'true');
          await AsyncStorage.setItem('user', JSON.stringify(currentUser));
          debugLog('Successfully stored auth state');
        } catch (storageError) {
          debugLog('Warning: Could not save auth state to storage:', storageError);
        }
        
        return currentUser;
      }
      
      throw new Error('Sign in failed: Authentication incomplete');
    } catch (error) {
      debugLog('=== Sign In Error Details ===');
      if (error instanceof Error) {
        debugLog('Error type:', error.constructor.name);
        debugLog('Error name:', error.name);
        debugLog('Error message:', error.message);
        debugLog('Error stack:', error.stack);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      await AmplifyAuth.signOut();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      debugLog('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        user,
        signIn: handleSignIn,
        signUp: async (username, password, email, phoneNumber, familyName) => {
          try {
            return await AmplifyAuth.signUp({
              username,
              password,
              options: {
                userAttributes: {
                  email,
                  phone_number: phoneNumber,
                  family_name: familyName,
                  name: username,
                }
              }
            });
          } catch (error) {
            debugLog('Sign up error:', error);
            throw error;
          }
        },
        confirmSignUp: async (username, code) => {
          try {
            return await AmplifyAuth.confirmSignUp({
              username,
              confirmationCode: code
            });
          } catch (error) {
            debugLog('Confirm sign up error:', error);
            throw error;
          }
        },
        verifyCode: async (username, code) => {
          try {
            return await AmplifyAuth.confirmSignUp({
              username,
              confirmationCode: code
            });
          } catch (error) {
            debugLog('Verify code error:', error);
            throw error;
          }
        },
        resendConfirmationCode: async (username) => {
          try {
            return await AmplifyAuth.resendSignUpCode({
              username
            });
          } catch (error) {
            debugLog('Resend code error:', error);
            throw error;
          }
        },
        signOut: handleSignOut,
        forgotPassword: async (username) => {
          try {
            return await AmplifyAuth.resetPassword({
              username
            });
          } catch (error) {
            debugLog('Forgot password error:', error);
            throw error;
          }
        },
        forgotPasswordSubmit: async (username, code, newPassword) => {
          try {
            return await AmplifyAuth.confirmResetPassword({
              username,
              confirmationCode: code,
              newPassword
            });
          } catch (error) {
            debugLog('Forgot password submit error:', error);
            throw error;
          }
        },
        devBypassLogin: async (username) => {
          setUser({ username } as AuthUser);
          setIsAuthenticated(true);
          return { isSignedIn: true };
        }
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

