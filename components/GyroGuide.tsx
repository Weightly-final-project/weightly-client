import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { DeviceMotion } from 'expo-sensors';

interface GyroGuideProps {
  onGyroValid: React.Dispatch<React.SetStateAction<boolean>>;
}

export const GyroGuide: React.FC<GyroGuideProps> = ({ onGyroValid }) => {
  const [{ beta, gamma }, setGyro] = useState({ beta: 0, gamma: 0 });
  const [isValid, setIsValid] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    _subscribe();
    return () => _unsubscribe();
  }, []);

  useEffect(() => {
    const isValid = Math.abs(Math.abs(gamma) - 90) < 15 && Math.abs(beta) < 15;

    onGyroValid(prev => {
      if (prev !== isValid) {
        setIsValid(isValid);
        return isValid;
      }
      return prev;
    });
  }, [beta, gamma, onGyroValid]);

  const _subscribe = () => {
    setSubscription(
      DeviceMotion.addListener(({ rotation }) => {
        // Convert rotation rate to degrees
        setGyro({
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
      return isValid
        ? "Perfect! Hold steady"
        : "Hold your phone perpendicular to the ground";
  };

  return (
    <View style={styles.container}>
      <View style={[
        styles.indicator,
        {
          backgroundColor: isValid
            ? 'rgba(76, 175, 80, 0.8)' 
            : 'rgba(244, 67, 54, 0.8)'
        }
      ]}>
        <Text style={styles.text}>{getGuideMessage()}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch', // Add this line
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