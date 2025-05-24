import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Accelerometer } from 'expo-sensors';

interface OrientationGuideProps {
  onOrientationValid: React.Dispatch<React.SetStateAction<boolean>>;
}

export const OrientationGuide: React.FC<OrientationGuideProps> = ({ onOrientationValid }) => {
  const [{ x, y }, setOrientation] = useState({ x: 0, y: 0 });
  const [isValid, setIsValid] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    _subscribe();
    return () => _unsubscribe();
  }, []);

  // First effect to calculate validity
  useEffect(() => {
    const newIsValid = !(Math.abs(y) > Math.abs(x));
    if (newIsValid !== isValid) {
      setIsValid(newIsValid);
      onOrientationValid(newIsValid);
    }
  }, [x, y, isValid, onOrientationValid]);

  const _subscribe = () => {
    setSubscription(
      Accelerometer.addListener(({ x, y }) => setOrientation({x,y}))
    );
    Accelerometer.setUpdateInterval(100);
  };

  const _unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  const getGuideMessage = () => {
      return isValid
        ? "Perfect! Hold steady"
        : "Hold your phone horizontaly";
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