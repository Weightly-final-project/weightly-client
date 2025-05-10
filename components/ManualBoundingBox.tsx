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
    
    return {
      left: boxCoords.left * scaleX,
      top: boxCoords.top * scaleY,
      width: boxCoords.width * scaleX,
      height: boxCoords.height * scaleY
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
      setBoxStart({ x: locationX, y: locationY });
      setBoxEnd({ x: locationX, y: locationY });
    },
    onPanResponderMove: (evt) => {
      if (isAdjusting || !boxStart || zoomEnabled) return;
      const { locationX, locationY } = evt.nativeEvent;
      setBoxEnd({ x: locationX, y: locationY });
    },
    onPanResponderRelease: () => {
      if (isAdjusting || zoomEnabled) return;
      setIsAdjusting(true);
      generatePreview();
    },
  });

  // Create handle pan responder
  const createHandlePanResponder = (handleType: string) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !zoomEnabled,
      onPanResponderGrant: (evt) => {
        if (zoomEnabled) return;
        const { locationX, locationY } = evt.nativeEvent;
        setActiveHandler(handleType);
        setInitialTouch({ x: locationX, y: locationY });
        setInitialBox({ start: boxStart ? { ...boxStart } : null, end: boxEnd ? { ...boxEnd } : null });
      },
      onPanResponderMove: (evt) => {
        if (!boxStart || !boxEnd || !initialTouch || !initialBox || !initialBox.start || !initialBox.end || zoomEnabled) return;
        
        const { locationX, locationY } = evt.nativeEvent;
        const dx = locationX - initialTouch.x;
        const dy = locationY - initialTouch.y;
        
        // Define the minSize to prevent the box from becoming too small
        const minSize = 20;
        
        // Handle different controls (corners and edges)
        switch (handleType) {
          case 'topLeft':
            const newStartX = initialBox.start.x + dx;
            const newStartY = initialBox.start.y + dy;
            const newWidthFromLeft = initialBox.end.x - newStartX;
            const newHeightFromTop = initialBox.end.y - newStartY;
            
            if (newWidthFromLeft >= minSize && newHeightFromTop >= minSize) {
              setBoxStart({ x: newStartX, y: newStartY });
            } else if (newWidthFromLeft >= minSize) {
              setBoxStart({ x: newStartX, y: boxStart.y });
            } else if (newHeightFromTop >= minSize) {
              setBoxStart({ x: boxStart.x, y: newStartY });
            }
            break;
            
          case 'topRight':
            const newEndX = initialBox.end.x + dx;
            const newEndY = initialBox.start.y + dy;
            const newWidthFromRight = newEndX - initialBox.start.x;
            const newHeightFromTopRight = initialBox.end.y - newEndY;
            
            if (newWidthFromRight >= minSize && newHeightFromTopRight >= minSize) {
              setBoxEnd({ x: newEndX, y: boxEnd.y });
              setBoxStart({ x: boxStart.x, y: newEndY });
            } else if (newWidthFromRight >= minSize) {
              setBoxEnd({ x: newEndX, y: boxEnd.y });
            } else if (newHeightFromTopRight >= minSize) {
              setBoxStart({ x: boxStart.x, y: newEndY });
            }
            break;
            
          case 'bottomLeft':
            const newLeftX = initialBox.start.x + dx;
            const newBottomY = initialBox.end.y + dy;
            const newWidthFromBottomLeft = initialBox.end.x - newLeftX;
            const newHeightFromBottomLeft = newBottomY - initialBox.start.y;
            
            if (newWidthFromBottomLeft >= minSize && newHeightFromBottomLeft >= minSize) {
              setBoxStart({ x: newLeftX, y: boxStart.y });
              setBoxEnd({ x: boxEnd.x, y: newBottomY });
            } else if (newWidthFromBottomLeft >= minSize) {
              setBoxStart({ x: newLeftX, y: boxStart.y });
            } else if (newHeightFromBottomLeft >= minSize) {
              setBoxEnd({ x: boxEnd.x, y: newBottomY });
            }
            break;
            
          case 'bottomRight':
            const newRightX = initialBox.end.x + dx;
            const newBottomRightY = initialBox.end.y + dy;
            const newWidthFromBottomRight = newRightX - initialBox.start.x;
            const newHeightFromBottomRight = newBottomRightY - initialBox.start.y;
            
            if (newWidthFromBottomRight >= minSize && newHeightFromBottomRight >= minSize) {
              setBoxEnd({ x: newRightX, y: newBottomRightY });
            } else if (newWidthFromBottomRight >= minSize) {
              setBoxEnd({ x: newRightX, y: boxEnd.y });
            } else if (newHeightFromBottomRight >= minSize) {
              setBoxEnd({ x: boxEnd.x, y: newBottomRightY });
            }
            break;
            
          case 'top':
            const newTop = initialBox.start.y + dy;
            const topHeight = initialBox.end.y - newTop;
            
            if (topHeight >= minSize) {
              setBoxStart({ x: boxStart.x, y: newTop });
            }
            break;
            
          case 'right':
            const newRight = initialBox.end.x + dx;
            const rightWidth = newRight - initialBox.start.x;
            
            if (rightWidth >= minSize) {
              setBoxEnd({ x: newRight, y: boxEnd.y });
            }
            break;
            
          case 'bottom':
            const newBottom = initialBox.end.y + dy;
            const bottomHeight = newBottom - initialBox.start.y;
            
            if (bottomHeight >= minSize) {
              setBoxEnd({ x: boxEnd.x, y: newBottom });
            }
            break;
            
          case 'left':
            const newLeft = initialBox.start.x + dx;
            const leftWidth = initialBox.end.x - newLeft;
            
            if (leftWidth >= minSize) {
              setBoxStart({ x: newLeft, y: boxStart.y });
            }
            break;
            
          case 'move':
            setBoxStart({ 
              x: initialBox.start.x + dx,
              y: initialBox.start.y + dy
            });
            setBoxEnd({ 
              x: initialBox.end.x + dx,
              y: initialBox.end.y + dy
            });
            break;
        }
        
        // Update preview when box changes
        generatePreview();
      },
      onPanResponderRelease: () => {
        setActiveHandler(null);
        setInitialTouch(null);
        setInitialBox(null);
      },
    });
  };
  
  // Handle pan responders
  const handlePanResponders = {
    topLeft: createHandlePanResponder('topLeft'),
    topRight: createHandlePanResponder('topRight'),
    bottomLeft: createHandlePanResponder('bottomLeft'),
    bottomRight: createHandlePanResponder('bottomRight'),
    top: createHandlePanResponder('top'),
    right: createHandlePanResponder('right'),
    bottom: createHandlePanResponder('bottom'),
    left: createHandlePanResponder('left'),
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
          {!isAdjusting 
            ? "Draw a box around the object" 
            : "Adjust corners for precise selection"}
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
              {/* The image with pan responder for drawing the box */}
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
                
                {/* Box overlay */}
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
                    {/* Box dimensions */}
                    {boxDimensions && (
                      <View style={styles.boxDimensions}>
                        <Text style={styles.boxDimensionsText}>
                          Adjust to fit your object tightly
                        </Text>
                      </View>
                    )}
                    
                    {isAdjusting && !zoomEnabled && (
                      <>
                        {/* Move handle (center) */}
                        <View
                          {...handlePanResponders.move.panHandlers}
                          style={[
                            styles.moveHandle,
                            activeHandler === 'move' && styles.activeHandle
                          ]}
                        />
                        
                        {/* Corner handles */}
                        <View
                          {...handlePanResponders.topLeft.panHandlers}
                          style={[
                            styles.cornerHandle, 
                            styles.topLeftHandle,
                            activeHandler === 'topLeft' && styles.activeHandle
                          ]}
                        />
                        <View
                          {...handlePanResponders.topRight.panHandlers}
                          style={[
                            styles.cornerHandle, 
                            styles.topRightHandle,
                            activeHandler === 'topRight' && styles.activeHandle
                          ]}
                        />
                        <View
                          {...handlePanResponders.bottomLeft.panHandlers}
                          style={[
                            styles.cornerHandle, 
                            styles.bottomLeftHandle,
                            activeHandler === 'bottomLeft' && styles.activeHandle
                          ]}
                        />
                        <View
                          {...handlePanResponders.bottomRight.panHandlers}
                          style={[
                            styles.cornerHandle, 
                            styles.bottomRightHandle,
                            activeHandler === 'bottomRight' && styles.activeHandle
                          ]}
                        />
                        
                        {/* Edge handles */}
                        <View
                          {...handlePanResponders.top.panHandlers}
                          style={[
                            styles.edgeHandle, 
                            styles.topEdgeHandle,
                            activeHandler === 'top' && styles.activeHandle
                          ]}
                        />
                        <View
                          {...handlePanResponders.right.panHandlers}
                          style={[
                            styles.edgeHandle, 
                            styles.rightEdgeHandle,
                            activeHandler === 'right' && styles.activeHandle
                          ]}
                        />
                        <View
                          {...handlePanResponders.bottom.panHandlers}
                          style={[
                            styles.edgeHandle, 
                            styles.bottomEdgeHandle,
                            activeHandler === 'bottom' && styles.activeHandle
                          ]}
                        />
                        <View
                          {...handlePanResponders.left.panHandlers}
                          style={[
                            styles.edgeHandle, 
                            styles.leftEdgeHandle,
                            activeHandler === 'left' && styles.activeHandle
                          ]}
                        />
                      </>
                    )}
                  </View>
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
              style={styles.previewImage}
              resizeMode="contain"
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
  cornerHandle: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 2,
    borderColor: '#00ff00',
    zIndex: 10,
  },
  topLeftHandle: {
    top: -17,
    left: -17,
  },
  topRightHandle: {
    top: -17,
    right: -17,
  },
  bottomLeftHandle: {
    bottom: -17,
    left: -17,
  },
  bottomRightHandle: {
    bottom: -17,
    right: -17,
  },
  edgeHandle: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 2,
    borderColor: '#00ff00',
    zIndex: 5,
  },
  topEdgeHandle: {
    top: -12,
    left: '25%',
    width: '50%',
    height: 24,
    borderRadius: 12,
  },
  rightEdgeHandle: {
    right: -12,
    top: '25%',
    width: 24,
    height: '50%',
    borderRadius: 12,
  },
  bottomEdgeHandle: {
    bottom: -12,
    left: '25%',
    width: '50%',
    height: 24,
    borderRadius: 12,
  },
  leftEdgeHandle: {
    left: -12,
    top: '25%',
    width: 24,
    height: '50%',
    borderRadius: 12,
  },
  moveHandle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 2,
    borderColor: '#00ff00',
    left: '50%',
    top: '50%',
    marginLeft: -20,
    marginTop: -20,
    zIndex: 4,
  },
  activeHandle: {
    backgroundColor: '#00ff00',
    transform: [{ scale: 1.1 }],
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
    borderWidth: 2,
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
  boxDimensions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 4,
    alignItems: 'center',
  },
  boxDimensionsText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  }
}); 