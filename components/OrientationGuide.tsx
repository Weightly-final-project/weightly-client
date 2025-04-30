import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { DeviceMotion } from 'expo-sensors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface OrientationGuideProps {
  onOrientationValid: (isValid: boolean) => void;
  mode: 'top-down' | 'horizontal';
}

export const OrientationGuide: React.FC<OrientationGuideProps> = ({ onOrientationValid, mode }) => {
  const [{ beta, gamma }, setOrientation] = useState({ beta: 0, gamma: 0 });
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    _subscribe();
    return () => _unsubscribe();
  }, []);

  useEffect(() => {
    let isValid = false;
    if (mode === 'top-down') {
      // For top-down photos, we want the phone to be parallel to the ground (beta ≈ 90°)
      isValid = Math.abs(beta - 90) < 15;
    } else {
      // For horizontal photos, we want the phone to be perpendicular to the ground (beta ≈ 0°)
      isValid = Math.abs(beta) < 15;
    }
    onOrientationValid(isValid);
  }, [beta, gamma, mode]);

  const _subscribe = () => {
    setSubscription(
      DeviceMotion.addListener(({ rotation }) => {
        // Convert rotation rate to degrees
        setOrientation({
          beta: rotation.beta * (180 / Math.PI),
          gamma: rotation.gamma * (180 / Math.PI),
        });
      })
    );
    DeviceMotion.setUpdateInterval(100); // Update every 100ms
  };

  const _unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  const getGuideMessage = () => {
    if (mode === 'top-down') {
      return Math.abs(beta - 90) < 15 
        ? "Perfect! Hold steady"
        : "Hold your phone parallel to the ground";
    } else {
      return Math.abs(beta) < 15
        ? "Perfect! Hold steady"
        : "Hold your phone perpendicular to the ground";
    }
  };

  return (
    <View style={styles.container}>
      <View style={[
        styles.indicator,
        {
          backgroundColor: Math.abs(mode === 'top-down' ? beta - 90 : beta) < 15 
            ? 'rgba(76, 175, 80, 0.8)' 
            : 'rgba(244, 67, 54, 0.8)'
        }
      ]}>
        <MaterialCommunityIcons 
          name={mode === 'top-down' ? 'arrow-down' : 'camera'} 
          size={24} 
          color="white" 
        />
        <Text style={styles.text}>{getGuideMessage()}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 