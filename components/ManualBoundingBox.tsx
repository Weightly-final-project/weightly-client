import React, { useState, useRef } from 'react';
import { View, Image, PanResponder, StyleSheet, Dimensions } from 'react-native';

interface ManualBoundingBoxProps {
  imageUri: string;
  onBoundingBoxSelected: (bbox: { minX: number, minY: number, maxX: number, maxY: number }) => void;
}

export const ManualBoundingBox: React.FC<ManualBoundingBoxProps> = ({ imageUri, onBoundingBoxSelected }) => {
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [boxEnd, setBoxEnd] = useState<{ x: number; y: number } | null>(null);
  const [imageLayout, setImageLayout] = useState<{ width: number; height: number } | null>(null);
  const imageRef = useRef<Image>(null);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setBoxStart({ x: locationX, y: locationY });
      setBoxEnd({ x: locationX, y: locationY });
    },
    onPanResponderMove: (evt) => {
      if (boxStart) {
        const { locationX, locationY } = evt.nativeEvent;
        setBoxEnd({ x: locationX, y: locationY });
      }
    },
    onPanResponderRelease: () => {
      if (boxStart && boxEnd && imageLayout) {
        // Convert coordinates to normalized format (0-1)
        const bbox = {
          minX: Math.min(boxStart.x, boxEnd.x) / imageLayout.width,
          minY: Math.min(boxStart.y, boxEnd.y) / imageLayout.height,
          maxX: Math.max(boxStart.x, boxEnd.x) / imageLayout.width,
          maxY: Math.max(boxStart.y, boxEnd.y) / imageLayout.height,
        };
        onBoundingBoxSelected(bbox);
      }
      setBoxStart(null);
      setBoxEnd(null);
    },
  });

  const renderBox = () => {
    if (!boxStart || !boxEnd) return null;

    const left = Math.min(boxStart.x, boxEnd.x);
    const top = Math.min(boxStart.y, boxEnd.y);
    const width = Math.abs(boxEnd.x - boxStart.x);
    const height = Math.abs(boxEnd.y - boxStart.y);

    return (
      <View
        style={[
          styles.box,
          {
            left,
            top,
            width,
            height,
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View {...panResponder.panHandlers} style={styles.imageContainer}>
        <Image
          ref={imageRef}
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setImageLayout({ width, height });
          }}
        />
        {renderBox()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
  },
}); 