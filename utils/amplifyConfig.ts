import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from '@aws-amplify/auth/cognito';
import * as AmplifyAuth from '@aws-amplify/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';

// Add debug logging
const debugLog = (message: string, ...args: any[]) => {
  console.log(`[Amplify Config] ${message}`, ...args);
};

// Configure Amplify with the minimal required configuration
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || '',
      region: 'eu-west-1',
      // Configure for username/password auth
      authenticationFlowType: 'USER_PASSWORD_AUTH'
    }
  }
};

export const configureAmplify = async () => {
  try {
    debugLog('=== Starting Amplify Configuration ===');
    
    // First check if we have valid environment variables
    if (!process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || !process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID) {
      throw new Error('Missing required Cognito configuration');
    }
    
    // Log the actual values being used (be careful with this in production)
    debugLog('Using Cognito configuration:', {
      userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID,
      userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID,
      region: 'eu-west-1',
      authFlow: 'USER_PASSWORD_AUTH'
    });
    
    // Set the storage mechanism before configuring
    debugLog('Setting AsyncStorage as token storage provider...');
    await cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);
    
    // Configure Amplify
    debugLog('Applying configuration:', amplifyConfig);
    Amplify.configure(amplifyConfig);
    
    // Additional verification
    try {
      const currentConfig = Amplify.getConfig();
      debugLog('Verified Amplify configuration:', currentConfig);
    } catch (configError) {
      debugLog('Error verifying configuration:', configError);
    }
    
    debugLog('=== Amplify Configuration Complete ===');
  } catch (error) {
    debugLog('=== Amplify Configuration Error ===');
    debugLog('Error:', error);
    throw error;
  }
}; 