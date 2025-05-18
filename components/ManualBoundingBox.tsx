import React, { useState, useRef, useEffect } from 'react';
import { View, Image, PanResponder, StyleSheet, Dimensions, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedGestureHandler, 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  runOnJS
} from 'react-native-reanimated';

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
  const [activeHandler, setActiveHandler] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialTouch, setInitialTouch] = useState<{ x: number; y: number } | null>(null);
  const [initialBox, setInitialBox] = useState<{ start: { x: number; y: number } | null, end: { x: number; y: number } | null } | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [previewImageSize, setPreviewImageSize] = useState<{ width: number; height: number } | null>(null);
  const imageRef = useRef<Image>(null);
  const previewRef = useRef<View>(null);
  
  // Zoom related values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  // Preview settings
  const [showPreview, setShowPreview] = useState(false);
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  
  // Add a tip for tighter bounding box
  const [showTightBoxTip, setShowTightBoxTip] = useState(true);

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
  
  // Toggle zoom mode
  const toggleZoom = () => {
    setZoomEnabled(!zoomEnabled);
    if (zoomEnabled) {
      // Reset zoom when disabling
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  };
  
  // Calculate scaling for preview
  const getPreviewBoxCoordinates = () => {
    if (!boxCoords || !imageLayout || !previewImageSize) return null;
    
    // Calculate scale factor between original image and preview
    const scaleX = previewImageSize.width / imageLayout.width;
    const scaleY = previewImageSize.height / imageLayout.height;
    const scale = Math.min(scaleX, scaleY); // Use the smaller scale to maintain aspect ratio
    
    // Center the preview
    const scaledWidth = imageLayout.width * scale;
    const scaledHeight = imageLayout.height * scale;
    const offsetX = (previewImageSize.width - scaledWidth) / 2;
    const offsetY = (previewImageSize.height - scaledHeight) / 2;
    
    return {
      left: boxCoords.left * scale + offsetX,
      top: boxCoords.top * scale + offsetY,
      width: boxCoords.width * scale,
      height: boxCoords.height * scale
    };
  };

  // Generate a preview of the selected area
  const generatePreview = () => {
    if (boxStart && boxEnd && imageLayout) {
      // For simplicity in this example, we'll use the same image
      // In a real app, you might want to crop the image here
      setPreviewSource(imageUri);
      setShowPreview(true);
      // Hide tip after first selection
      setShowTightBoxTip(false);
    }
  };

  // Pinch gesture handler for zooming
  const pinchHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startScale = savedScale.value;
    },
    onActive: (event: any, ctx: any) => {
      scale.value = Math.max(1, Math.min(5, ctx.startScale * event.scale));
    },
    onEnd: () => {
      savedScale.value = scale.value;
    },
  });

  // Pan gesture handler for moving around when zoomed
  const panHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startX = savedTranslateX.value;
      ctx.startY = savedTranslateY.value;
    },
    onActive: (event: any, ctx: any) => {
      translateX.value = ctx.startX + event.translationX;
      translateY.value = ctx.startY + event.translationY;
    },
    onEnd: () => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    },
  });

  // Animated style for the image container
  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Drawing box pan responder
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !isAdjusting && !zoomEnabled,
    onPanResponderGrant: (evt) => {
      if (isAdjusting || zoomEnabled) return;
      const { locationX, locationY } = evt.nativeEvent;
      const scaledX = (locationX - translateX.value) / scale.value;
      const scaledY = (locationY - translateY.value) / scale.value;
      setBoxStart({ x: scaledX, y: scaledY });
      setBoxEnd({ x: scaledX, y: scaledY });
    },
    onPanResponderMove: (evt) => {
      if (isAdjusting || !boxStart || zoomEnabled) return;
      const { locationX, locationY } = evt.nativeEvent;
      const scaledX = (locationX - translateX.value) / scale.value;
      const scaledY = (locationY - translateY.value) / scale.value;
      
      if (imageLayout) {
        const maxWidth = imageLayout.width * 0.8; // Back to 80% for initial drawing
        const maxHeight = imageLayout.height * 0.8;
        
        const newX = Math.min(Math.max(scaledX, 0), imageLayout.width);
        const newY = Math.min(Math.max(scaledY, 0), imageLayout.height);
        
        const width = Math.abs(newX - boxStart.x);
        const height = Math.abs(newY - boxStart.y);
        
        if (width <= maxWidth && height <= maxHeight) {
          setBoxEnd({ x: newX, y: newY });
        }
      }
    },
    onPanResponderRelease: () => {
      if (isAdjusting || zoomEnabled) return;
      setIsAdjusting(true);
      generatePreview();
    },
  });

  // Simplify the handle pan responder to only handle moving
  const createHandlePanResponder = (handleType: string) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !zoomEnabled,
      onMoveShouldSetPanResponder: () => !zoomEnabled,
      onPanResponderGrant: (evt) => {
        if (zoomEnabled) return;
        const { locationX, locationY } = evt.nativeEvent;
        const scaledX = (locationX - translateX.value) / scale.value;
        const scaledY = (locationY - translateY.value) / scale.value;
        setActiveHandler(handleType);
        setInitialTouch({ x: scaledX, y: scaledY });
        setInitialBox({ start: boxStart ? { ...boxStart } : null, end: boxEnd ? { ...boxEnd } : null });
      },
      onPanResponderMove: (evt) => {
        if (!boxStart || !boxEnd || !initialTouch || !initialBox || !initialBox.start || !initialBox.end || zoomEnabled || !imageLayout) return;
        
        const { locationX, locationY } = evt.nativeEvent;
        const scaledX = (locationX - translateX.value) / scale.value;
        const scaledY = (locationY - translateY.value) / scale.value;
        const dx = scaledX - initialTouch.x;
        const dy = scaledY - initialTouch.y;

        const constrainToImage = (x: number, y: number) => ({
          x: Math.min(Math.max(x, 0), imageLayout.width),
          y: Math.min(Math.max(y, 0), imageLayout.height)
        });

        // Only handle moving the entire box
        const newStart = constrainToImage(initialBox.start.x + dx, initialBox.start.y + dy);
        const newEnd = constrainToImage(initialBox.end.x + dx, initialBox.end.y + dy);
        
        // Only move if both points are within bounds
        if (newStart.x >= 0 && newEnd.x <= imageLayout.width &&
            newStart.y >= 0 && newEnd.y <= imageLayout.height) {
          setBoxStart(newStart);
          setBoxEnd(newEnd);
        }
        
        generatePreview();
      },
      onPanResponderRelease: () => {
        setActiveHandler(null);
        setInitialTouch(null);
        setInitialBox(null);
      },
    });
  };
  
  // Simplify to only create move handle
  const handlePanResponders = {
    move: createHandlePanResponder('move')
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
    setActiveHandler(null);
    setInitialTouch(null);
    setInitialBox(null);
    setShowPreview(false);
    setShowTightBoxTip(true);
  };
  
  // Calculate box dimensions in cm
  const getBoxDimensions = () => {
    if (!boxCoords || !imageLayout) return null;
    
    // This is just a placeholder calculation - in a real app you'd use
    // calibration with a known object to get actual cm dimensions
    const pixelsToCm = 0.05; // example conversion factor
    
    return {
      width: (boxCoords.width * pixelsToCm).toFixed(1),
      height: (boxCoords.height * pixelsToCm).toFixed(1)
    };
  };
  
  const boxDimensions = getBoxDimensions();
  const previewBoxCoords = getPreviewBoxCoordinates();

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.instructions}>
          Draw a box around the object
        </Text>
        <TouchableOpacity 
          style={[styles.zoomButton, zoomEnabled ? styles.zoomActiveButton : {}]} 
          onPress={toggleZoom}
        >
          <Text style={styles.zoomButtonText}>
            {zoomEnabled ? "Exit Zoom" : "Zoom"}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Tip for tighter box */}
      {showTightBoxTip && (
        <View style={styles.tightBoxTip}>
          <Text style={styles.tightBoxTipText}>
            ✓ Draw a box that fits tightly around the object
          </Text>
          <Text style={styles.tightBoxTipText}>
            ✓ Use corner handles to resize precisely
          </Text>
        </View>
      )}
      
      {/* Main image area with zoom and pan gestures */}
      <PinchGestureHandler
        enabled={zoomEnabled}
        onGestureEvent={pinchHandler}
      >
        <Animated.View style={styles.pinchContainer}>
          <PanGestureHandler
            enabled={zoomEnabled}
            onGestureEvent={panHandler}
          >
            <Animated.View style={[styles.imageContainer, zoomEnabled ? animatedImageStyle : {}]}>
              <View {...(zoomEnabled ? {} : panResponder.panHandlers)} style={styles.imageWrapper}>
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
                
                {boxCoords && (
                  <Animated.View
                    style={[
                      styles.box,
                      {
                        left: boxCoords.left * scale.value + translateX.value,
                        top: boxCoords.top * scale.value + translateY.value,
                        width: Math.min(boxCoords.width * scale.value, imageLayout?.width || 0),
                        height: Math.min(boxCoords.height * scale.value, imageLayout?.height || 0),
                        transform: [{ scale: 1 }]
                      },
                    ]}
                  >
                    {isAdjusting && !zoomEnabled && (
                      <View {...handlePanResponders.move.panHandlers} style={[styles.touchArea, styles.moveTouch]}>
                        <View style={[styles.moveHandle, activeHandler === 'move' && styles.activeHandle]} />
                      </View>
                    )}
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </PinchGestureHandler>
      
      {/* Preview panel showing what's selected */}
      {showPreview && isAdjusting && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Preview of Selection:</Text>
          <View 
            style={styles.previewImageContainer}
            ref={previewRef}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setPreviewImageSize({ width, height });
            }}
          >
            <Image
              source={{ uri: previewSource || '' }}
              style={[styles.previewImage, { resizeMode: 'contain' }]}
            />
            
            {/* Overlay bounding box on the preview */}
            {previewBoxCoords && (
              <View
                style={[
                  styles.previewBox,
                  {
                    left: previewBoxCoords.left,
                    top: previewBoxCoords.top,
                    width: previewBoxCoords.width,
                    height: previewBoxCoords.height,
                  },
                ]}
              />
            )}
            
            <View style={styles.previewOverlay}>
              <Text style={styles.previewDescription}>
                This is the area that will be marked as a wood object
              </Text>
            </View>
          </View>
        </View>
      )}
      
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
      
      {/* Zoom instructions */}
      {zoomEnabled && (
        <View style={styles.zoomInstructions}>
          <Text style={styles.zoomInstructionsText}>
            • Pinch to zoom in/out
          </Text>
          <Text style={styles.zoomInstructionsText}>
            • Drag to move around
          </Text>
          <Text style={styles.zoomInstructionsText}>
            • Tap "Exit Zoom" to continue editing
          </Text>
        </View>
      )}
    </GestureHandlerRootView>
  );
};

const { width, height } = Dimensions.get('window');

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
  pinchContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  box: {
    position: 'absolute',
    borderWidth: 1,
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
  cornerHandle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: '#00ff00',
  },
  topLeftHandle: {
    top: -5,
    left: -5,
  },
  topRightHandle: {
    top: -5,
    right: -5,
  },
  bottomLeftHandle: {
    bottom: -5,
    left: -5,
  },
  bottomRightHandle: {
    bottom: -5,
    right: -5,
  },
  edgeHandle: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: '#00ff00',
    zIndex: 5,
  },
  topEdgeHandle: {
    top: -4,
    left: '30%',
    width: '40%',
    height: 8,
    borderRadius: 4,
  },
  rightEdgeHandle: {
    right: -4,
    top: '30%',
    width: 8,
    height: '40%',
    borderRadius: 4,
  },
  bottomEdgeHandle: {
    bottom: -4,
    left: '30%',
    width: '40%',
    height: 8,
    borderRadius: 4,
  },
  leftEdgeHandle: {
    left: -4,
    top: '30%',
    width: 8,
    height: '40%',
    borderRadius: 4,
  },
  moveHandle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: '#00ff00',
  },
  activeHandle: {
    backgroundColor: '#00ff00',
    transform: [{ scale: 1.2 }],
  },
  zoomButton: {
    backgroundColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  zoomActiveButton: {
    backgroundColor: '#4CAF50',
  },
  zoomButtonText: {
    color: '#FFF',
    fontSize: 14,
  },
  zoomInstructions: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
    alignItems: 'center',
  },
  zoomInstructionsText: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 4,
  },
  previewContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 12,
  },
  previewTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  previewImageContainer: {
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#222',
  },
  previewBox: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#00ff00',
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    zIndex: 5,
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
  },
  previewDescription: {
    color: '#FFF',
    fontSize: 12,
    textAlign: 'center',
  },
  tightBoxTip: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tightBoxTipText: {
    color: '#4CAF50',
    fontSize: 14,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  touchArea: {
    position: 'absolute',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  moveTouch: {
    position: 'absolute',
    width: 44,
    height: 44,
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -22,
  },
}); 