import React, { createContext, useState, useContext, useEffect } from "react";
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js';
import AsyncStorage from "@react-native-async-storage/async-storage";

// Configure Cognito
const poolData = {
  UserPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || '',
  ClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || '',
};

console.log("============ AUTH CONFIGURATION ============");
console.log("User Pool ID:", poolData.UserPoolId);
console.log("Client ID:", poolData.ClientId);

const userPool = new CognitoUserPool(poolData);

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
  verifyCode: (username: string, code: string) => Promise<void>;
  resendConfirmationCode: (username: string) => Promise<void>;
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
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    setIsLoading(true);
    try {
      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.getSession((err: any, session: any) => {
          if (err) {
            debugLog('Session error:', err);
            setIsAuthenticated(false);
            setUser(null);
          } else if (session.isValid()) {
            debugLog('Valid session found');
            cognitoUser.getUserAttributes((err: any, attributes: any) => {
              if (err) {
                debugLog('Error getting user attributes:', err);
                setIsAuthenticated(false);
                setUser(null);
              } else {
                const userData = {
                  username: cognitoUser.getUsername(),
                  attributes: attributes.reduce((acc: any, attr: any) => {
                    acc[attr.Name] = attr.Value;
                    return acc;
                  }, {})
                };
                debugLog('User authenticated:', userData);
                setIsAuthenticated(true);
                setUser(userData);
              }
            });
          } else {
            debugLog('Session invalid');
            setIsAuthenticated(false);
            setUser(null);
          }
        });
      } else {
        debugLog('No current user');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      debugLog('Error checking auth state:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (username: string, password: string): Promise<any> => {
    setIsLoading(true);
    return new Promise((resolve, reject) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: username,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: userPool,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session) => {
          debugLog('Sign in successful:', session);
          cognitoUser.getUserAttributes((err: any, attributes: any) => {
            if (err) {
              debugLog('Error getting user attributes:', err);
              reject(err);
            } else {
              const userData = {
                username: cognitoUser.getUsername(),
                attributes: attributes.reduce((acc: any, attr: any) => {
                  acc[attr.Name] = attr.Value;
                  return acc;
                }, {})
              };
              setIsAuthenticated(true);
              setUser(userData);
              resolve(userData);
            }
          });
        },
        onFailure: (err) => {
          debugLog('Sign in failed:', err);
          reject(err);
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          debugLog('New password required');
          reject(new Error('New password required'));
        },
        mfaRequired: (challengeName, challengeParameters) => {
          debugLog('MFA required');
          reject(new Error('MFA required'));
        },
        totpRequired: (challengeName, challengeParameters) => {
          debugLog('TOTP required');
          reject(new Error('TOTP required'));
        },
        selectMFAType: (challengeName, challengeParameters) => {
          debugLog('Select MFA type');
          reject(new Error('Select MFA type'));
        },
      });
    }).finally(() => {
      setIsLoading(false);
    });
  };

  const handleSignOut = async (): Promise<void> => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        user,
        signIn: handleSignIn,
        signUp: async (username, password, email, phoneNumber, familyName) => {
          return new Promise((resolve, reject) => {
            const attributeList = [
              new CognitoUserAttribute({ Name: 'email', Value: email }),
              new CognitoUserAttribute({ Name: 'phone_number', Value: phoneNumber }),
              new CognitoUserAttribute({ Name: 'family_name', Value: familyName }),
              new CognitoUserAttribute({ Name: 'name', Value: username }),
            ];
            const validationData: CognitoUserAttribute[] = [];
            userPool.signUp(
              username,
              password,
              attributeList,
              validationData,
              (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(result);
                }
              }
            );
          });
        },
        confirmSignUp: async (username, code) => {
          return new Promise((resolve, reject) => {
            const cognitoUser = new CognitoUser({
              Username: username,
              Pool: userPool,
            });
            cognitoUser.confirmRegistration(code, true, (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
        },
        verifyCode: async (username, code) => {
          return new Promise((resolve, reject) => {
            const cognitoUser = new CognitoUser({
              Username: username,
              Pool: userPool,
            });
            cognitoUser.confirmRegistration(code, true, (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
        },
        resendConfirmationCode: async (username) => {
          return new Promise((resolve, reject) => {
            const cognitoUser = new CognitoUser({
              Username: username,
              Pool: userPool,
            });
            cognitoUser.resendConfirmationCode((err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
        },
        signOut: handleSignOut,
        forgotPassword: async (username) => {
          return new Promise((resolve, reject) => {
            const cognitoUser = new CognitoUser({
              Username: username,
              Pool: userPool,
            });
            cognitoUser.forgotPassword({
              onSuccess: (result) => resolve(result),
              onFailure: (err) => reject(err),
            });
          });
        },
        forgotPasswordSubmit: async (username, code, newPassword) => {
          return new Promise((resolve, reject) => {
            const cognitoUser = new CognitoUser({
              Username: username,
              Pool: userPool,
            });
            cognitoUser.confirmPassword(code, newPassword, {
              onSuccess: () => resolve(),
              onFailure: (err) => reject(err),
            });
          });
        },
        devBypassLogin: async (username) => {
          setUser({ username });
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

