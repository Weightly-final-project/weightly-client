import React, { useState, useRef } from 'react';
import { View, Image, PanResponder, StyleSheet, Dimensions, TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ManualBoundingBoxProps {
  imageUri: string;
  onBoundingBoxSelected: (bbox: { minX: number, minY: number, maxX: number, maxY: number }) => void;
  onCancel: () => void;
}

export const ManualBoundingBox: React.FC<ManualBoundingBoxProps> = ({ imageUri, onBoundingBoxSelected, onCancel }) => {
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [boxEnd, setBoxEnd] = useState<{ x: number; y: number } | null>(null);
  const [imageLayout, setImageLayout] = useState<{ width: number; height: number } | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [activeCorner, setActiveCorner] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const imageRef = useRef<Image>(null);

  // Function to calculate box coordinates
  const getBoxCoordinates = () => {
    if (!boxStart || !boxEnd) return null;

    return {
      left: Math.min(boxStart.x, boxEnd.x),
      top: Math.min(boxStart.y, boxEnd.y),
      width: Math.abs(boxEnd.x - boxStart.x),
      height: Math.abs(boxEnd.y - boxStart.y),
      right: Math.max(boxStart.x, boxEnd.x),
      bottom: Math.max(boxStart.y, boxEnd.y)
    };
  };

  const boxCoords = getBoxCoordinates();

  // Drawing box pan responder
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !isAdjusting,
    onPanResponderGrant: (evt) => {
      if (isAdjusting) return;
      const { locationX, locationY } = evt.nativeEvent;
      setBoxStart({ x: locationX, y: locationY });
      setBoxEnd({ x: locationX, y: locationY });
    },
    onPanResponderMove: (evt) => {
      if (isAdjusting || !boxStart) return;
      const { locationX, locationY } = evt.nativeEvent;
      setBoxEnd({ x: locationX, y: locationY });
    },
    onPanResponderRelease: () => {
      if (isAdjusting) return;
      setIsAdjusting(true);
    },
  });

  // Corner adjustment pan responders
  const cornerPanResponders = {
    topLeft: PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        if (!boxStart || !boxEnd) return;
        const { locationX, locationY } = evt.nativeEvent;
        setBoxStart({ x: locationX, y: locationY });
      },
    }),
    topRight: PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        if (!boxStart || !boxEnd) return;
        const { locationX, locationY } = evt.nativeEvent;
        setBoxEnd({ x: locationX, y: boxEnd.y });
        setBoxStart({ x: boxStart.x, y: locationY });
      },
    }),
    bottomLeft: PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        if (!boxStart || !boxEnd) return;
        const { locationX, locationY } = evt.nativeEvent;
        setBoxStart({ x: locationX, y: boxStart.y });
        setBoxEnd({ x: boxEnd.x, y: locationY });
      },
    }),
    bottomRight: PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        if (!boxStart || !boxEnd) return;
        const { locationX, locationY } = evt.nativeEvent;
        setBoxEnd({ x: locationX, y: locationY });
      },
    }),
  };

  const handleSubmit = () => {
    if (boxStart && boxEnd && imageLayout) {
      setIsLoading(true);
      // Convert coordinates to normalized format (0-1)
      const bbox = {
        minX: Math.min(boxStart.x, boxEnd.x) / imageLayout.width,
        minY: Math.min(boxStart.y, boxEnd.y) / imageLayout.height,
        maxX: Math.max(boxStart.x, boxEnd.x) / imageLayout.width,
        maxY: Math.max(boxStart.y, boxEnd.y) / imageLayout.height,
      };
      onBoundingBoxSelected(bbox);
    }
  };

  const handleReset = () => {
    setBoxStart(null);
    setBoxEnd(null);
    setIsAdjusting(false);
    setActiveCorner(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.instructions}>
          {!isAdjusting 
            ? "Draw a box around the object" 
            : "Adjust corners for precise selection"}
        </Text>
      </View>
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
        
        {/* Box */}
        {boxCoords && (
          <View
            style={[
              styles.box,
              {
                left: boxCoords.left,
                top: boxCoords.top,
                width: boxCoords.width,
                height: boxCoords.height,
              },
            ]}
          >
            {isAdjusting && (
              <>
                {/* Corner points */}
                <View
                  {...cornerPanResponders.topLeft.panHandlers}
                  style={[
                    styles.cornerPoint, 
                    { top: -12, left: -12 },
                    activeCorner === 'topLeft' && styles.activeCorner
                  ]}
                  onTouchStart={() => setActiveCorner('topLeft')}
                  onTouchEnd={() => setActiveCorner(null)}
                />
                <View
                  {...cornerPanResponders.topRight.panHandlers}
                  style={[
                    styles.cornerPoint, 
                    { top: -12, right: -12 },
                    activeCorner === 'topRight' && styles.activeCorner
                  ]}
                  onTouchStart={() => setActiveCorner('topRight')}
                  onTouchEnd={() => setActiveCorner(null)}
                />
                <View
                  {...cornerPanResponders.bottomLeft.panHandlers}
                  style={[
                    styles.cornerPoint, 
                    { bottom: -12, left: -12 },
                    activeCorner === 'bottomLeft' && styles.activeCorner
                  ]}
                  onTouchStart={() => setActiveCorner('bottomLeft')}
                  onTouchEnd={() => setActiveCorner(null)}
                />
                <View
                  {...cornerPanResponders.bottomRight.panHandlers}
                  style={[
                    styles.cornerPoint, 
                    { bottom: -12, right: -12 },
                    activeCorner === 'bottomRight' && styles.activeCorner
                  ]}
                  onTouchStart={() => setActiveCorner('bottomRight')}
                  onTouchEnd={() => setActiveCorner(null)}
                />
              </>
            )}
          </View>
        )}
      </View>
      
      {isAdjusting && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.resetButton]} 
            onPress={handleReset}
          >
            <Text style={styles.buttonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.confirmButton]} 
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Confirm Selection</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
  instructions: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    flex: 1,
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
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    backgroundColor: '#333',
    flex: 1,
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    flex: 2,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cornerPoint: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 2,
    borderColor: '#00ff00',
  },
  activeCorner: {
    backgroundColor: '#00ff00',
    transform: [{ scale: 1.2 }],
  },
}); 