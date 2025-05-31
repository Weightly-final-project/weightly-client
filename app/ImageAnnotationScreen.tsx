import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, SafeAreaView, Text, Dimensions, Button, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import BoundingBox from '../components/BoundingBox'; // Adjusted path if BoundingBox is in ../components/
import { logger } from './features/camera/utils/logger';

interface Box {
  id: string; 
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected?: boolean; 
  label: string; 
}

const PAN_ACTIVE_OFFSET_THRESHOLD = 15; 

export default function ImageAnnotationScreen() {
  const { 
    imageUri, 
    mode, 
    currentPhotoIndexForAnnotation, // Received from CameraScreen
    processedImageUri: navProcessedImageUri, // Received from CameraScreen
    photosToCarryForward // Received from CameraScreen
  } = useLocalSearchParams<{
    imageUri: string;
    mode?: 'reference' | 'manual_capture';
    currentPhotoIndexForAnnotation?: string;
    processedImageUri?: string;
    photosToCarryForward?: string; // Base64 encoded string of CapturedPhoto[]
  }>();
  const router = useRouter();
  const [boxes, setBoxes] = useState<Box[]>([]);

  useEffect(() => {
    // console.log('[ImageAnnotationScreen] boxes state changed:', JSON.stringify(boxes));
    if (imageUri) {
    //   console.log('[ImageAnnotationScreen] imageUri is present:', imageUri);
    } else {
    //   console.log('[ImageAnnotationScreen] imageUri is NOT present.');
    }
  }, [boxes, imageUri]);

  const drawStartX = useSharedValue(0);
  const drawStartY = useSharedValue(0);
  const drawCurrentX = useSharedValue(0);
  const drawCurrentY = useSharedValue(0);
  const isDrawing = useSharedValue(false);

  const isMovingBox = useSharedValue(false);
  const movingBoxId = useSharedValue<string | null>(null);
  const moveGestureStartX = useSharedValue(0); 
  const moveGestureStartY = useSharedValue(0); 
  const movingBoxInitialX = useSharedValue(0); 
  const movingBoxInitialY = useSharedValue(0); 

  const isResizingBox = useSharedValue(false); 

  const assignLabel = (existingBoxes: Box[]): string => {
    if (existingBoxes.length === 0) {
      return "Rubkis cube";
    }
    if (existingBoxes.length === 1) {
      const rubkisExists = existingBoxes.some(box => box.label === "Rubkis cube");
      if (!rubkisExists) return "Rubkis cube"; 
      return "wood stack";
    }
    return ""; 
  };

  const addNewBox = (newBoxData: Omit<Box, 'id' | 'isSelected' | 'label'>) => {
    setBoxes(prevBoxes => {
      const currentBoxes = Array.isArray(prevBoxes) ? prevBoxes : [];
      if (currentBoxes.length >= 2) {
        runOnJS(Alert.alert)("Limit Reached", "You can only draw two boxes.");
        return currentBoxes; 
      }
      const label = assignLabel(currentBoxes);
      const newBoxWithIdAndLabel: Box = {
        ...newBoxData,
        id: Date.now().toString() + Math.random().toString(),
        isSelected: false,
        label: label,
      };
    //   console.log(`[ImageAnnotationScreen] Adding new box with label: ${label}`);
      return [...currentBoxes, newBoxWithIdAndLabel];
    });
  };

  const updateBoxPosition = (id: string, newX: number, newY: number) => {
    setBoxes(prevBoxes => 
      prevBoxes.map(box => 
        box.id === id ? { ...box, x: newX, y: newY } : box
      )
    );
  };

  const handleResizeBox = (id: string, newBoxData: { x: number; y: number; width: number; height: number }) => {
    setBoxes(prevBoxes =>
      prevBoxes.map(box =>
        box.id === id ? { ...box, ...newBoxData } : box
      )
    );
  };

  const handleResizeStart = (boxId: string) => {
    // console.log(`[ImageAnnotationScreen] handleResizeStart for box ${boxId}`);
    isResizingBox.value = true;
  };

  const handleResizeEnd = (boxId: string) => {
    // console.log(`[ImageAnnotationScreen] handleResizeEnd for box ${boxId}`);
    isResizingBox.value = false;
  };

  const handleResetBoxes = () => {
    // console.log('[ImageAnnotationScreen] Resetting boxes.');
    setBoxes([]);
    isDrawing.value = false; 
    isMovingBox.value = false;
    movingBoxId.value = null;
    isResizingBox.value = false; 
  };
  
  const handleDone = () => {
    // For 'reference' mode, ensure exactly one box is drawn.
    // This check does not apply to 'manual_capture' mode.
    if (mode === 'reference' && boxes.length !== 1) {
      Alert.alert(
        "Invalid Selection",
        "Please mark exactly one reference object (Rubik's cube).",
        [{ text: "OK" }]
      );
      return;
    }

    const finalProcessedImageUri = navProcessedImageUri || imageUri;

    logger.debug('Annotation complete, returning to camera', { 
      mode, 
      boxCount: boxes.length, 
      returnedPhotoIndex: currentPhotoIndexForAnnotation, 
      willPassExistingPhotos: !!photosToCarryForward 
    });

    router.replace({
      pathname: '/camera',
      params: {
        bboxData: JSON.stringify(boxes),
        processedImageUri: finalProcessedImageUri,
        mode: mode, // Pass back the mode it received
        returnedPhotoIndex: currentPhotoIndexForAnnotation, // Send back the index of the photo that was annotated
        existingPhotos: photosToCarryForward, // Pass back the photo state
        photoIndex: currentPhotoIndexForAnnotation // Crucial for CameraScreen's useCameraState to set initialPhotoIndex
      },
    });
  };

  const handleSelectBox = (selectedId: string) => {
    if (isDrawing.value || isMovingBox.value || isResizingBox.value) { 
    //   console.log('[ImageAnnotationScreen] handleSelectBox skipped due to active gesture.');
      return;
    }
    // console.log(`[ImageAnnotationScreen] handleSelectBox called for id: ${selectedId}`);
    setBoxes(prevBoxes => 
      prevBoxes.map(box => ({ 
        ...box, 
        isSelected: box.id === selectedId ? !box.isSelected : false 
      }))
    );
    isDrawing.value = false; 
  };
  
  const deselectAllBoxes = () => {
    // console.log('[ImageAnnotationScreen] deselectAllBoxes called');
    setBoxes(prevBoxes => prevBoxes.map(b => ({ ...b, isSelected: false })));
  };

  const _onGestureStartJS = (touchX: number, touchY: number) => {
    const currentSelectedBoxBeforeGesture = boxes.find(b => b.isSelected);
    // console.log('[GestureJS] _onGestureStartJS - currentSelectedBoxBeforeGesture:', currentSelectedBoxBeforeGesture ? currentSelectedBoxBeforeGesture.id : 'none', 'isResizing:', isResizingBox.value);

    if (isResizingBox.value) { 
        // console.log('[GestureJS] _onGestureStartJS - Bailing out: Resize is active.');
        return;
    }

    if (currentSelectedBoxBeforeGesture) {
      if (touchX >= currentSelectedBoxBeforeGesture.x && 
          touchX <= currentSelectedBoxBeforeGesture.x + currentSelectedBoxBeforeGesture.width &&
          touchY >= currentSelectedBoxBeforeGesture.y && 
          touchY <= currentSelectedBoxBeforeGesture.y + currentSelectedBoxBeforeGesture.height) {
        // console.log(`[GestureJS] Decided: Start MOVE for box ${currentSelectedBoxBeforeGesture.id}`);
        isMovingBox.value = true;
        isDrawing.value = false; 
        movingBoxId.value = currentSelectedBoxBeforeGesture.id;
        moveGestureStartX.value = touchX;
        moveGestureStartY.value = touchY;
        movingBoxInitialX.value = currentSelectedBoxBeforeGesture.x;
        movingBoxInitialY.value = currentSelectedBoxBeforeGesture.y;
      } else {
        // console.log('[GestureJS] Decided: Tap off selected box - Deselecting.');
        deselectAllBoxes(); 
        isDrawing.value = false; 
        isMovingBox.value = false;
      }
    } else {
    //   console.log('[GestureJS] Decided: Start DRAW.');
      deselectAllBoxes(); 
      isDrawing.value = true; 
      isMovingBox.value = false; 
      drawStartX.value = touchX;
      drawStartY.value = touchY;
      drawCurrentX.value = touchX;
      drawCurrentY.value = touchY;
    }
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (event) => {
    //   console.log('[Reanimated] PanGestureHandler onStart');
      if (isResizingBox.value) { 
          return; 
      }
      isDrawing.value = false; 
      isMovingBox.value = false;
      movingBoxId.value = null; 
      runOnJS(_onGestureStartJS)(event.x, event.y);
    },
    onActive: (event) => {
      if (isResizingBox.value) return; 

      if (isMovingBox.value && movingBoxId.value !== null) { 
        const deltaX = event.x - moveGestureStartX.value;
        const deltaY = event.y - moveGestureStartY.value;
        const newBoxX = movingBoxInitialX.value + deltaX;
        const newBoxY = movingBoxInitialY.value + deltaY;
        runOnJS(updateBoxPosition)(movingBoxId.value, newBoxX, newBoxY);
      } else if (isDrawing.value) {
        drawCurrentX.value = event.x;
        drawCurrentY.value = event.y;
      }
    },
    onEnd: (event) => {
      console.log('[Reanimated] PanGestureHandler onEnd');
      if (isResizingBox.value) { 
        //   console.log('[Reanimated] Main PGH onEnd - resize was active.');
      } else if (isMovingBox.value) {
        // Position already updated
      } else if (isDrawing.value) {
        const newBox = {
          x: Math.min(drawStartX.value, drawCurrentX.value),
          y: Math.min(drawStartY.value, drawCurrentY.value),
          width: Math.abs(drawCurrentX.value - drawStartX.value),
          height: Math.abs(drawCurrentY.value - drawStartY.value),
        };
        if (newBox.width > 5 && newBox.height > 5) {
          runOnJS(addNewBox)(newBox);
        }
      }
      if (!isResizingBox.value) {
        isDrawing.value = false;
        isMovingBox.value = false;
        movingBoxId.value = null;
      }
    },
    onFail: (event) => {
    //   console.log('[Reanimated] PanGestureHandler onFail');
      if (!isResizingBox.value) { 
        isDrawing.value = false;
        isMovingBox.value = false;
        movingBoxId.value = null; 
      }
    },
  });

  const animatedDrawingStyle = useAnimatedStyle(() => {
    if (!isDrawing.value) return { display: 'none' };
    return {
      position: 'absolute',
      left: Math.min(drawStartX.value, drawCurrentX.value),
      top: Math.min(drawStartY.value, drawCurrentY.value),
      width: Math.abs(drawCurrentX.value - drawStartX.value),
      height: Math.abs(drawCurrentY.value - drawStartY.value),
      borderWidth: 2,
      borderColor: 'blue',
      backgroundColor: 'rgba(0, 0, 255, 0.1)',
    };
  });

  if (!imageUri) {
    console.log('[ImageAnnotationScreen] No imageUri, rendering placeholder.');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.contentCentered}>
          <Text>No image URI provided.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const boxesToRender = Array.isArray(boxes) ? boxes : [];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'reference' 
              ? "Mark the Rubik's cube"
              : "Draw Bounding Boxes"}
          </Text>
          {mode === 'reference' && (
            <Text style={styles.subtitle}>
              Draw a box around the Rubik's cube for size reference
            </Text>
          )}
        </View>
        <PanGestureHandler 
          onGestureEvent={gestureHandler}
          activeOffsetX={[-PAN_ACTIVE_OFFSET_THRESHOLD, PAN_ACTIVE_OFFSET_THRESHOLD]}
          activeOffsetY={[-PAN_ACTIVE_OFFSET_THRESHOLD, PAN_ACTIVE_OFFSET_THRESHOLD]}
        >
          <Animated.View style={styles.imageContainer}> 
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            {boxesToRender.map((box) => (
              <BoundingBox
                key={box.id} 
                id={box.id}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                borderColor={box.isSelected ? 'green' : 'red'} 
                borderWidth={box.isSelected ? 3 : 2} 
                onSelect={handleSelectBox} 
                isSelected={box.isSelected} 
                onResizeStart={handleResizeStart}
                onResizeUpdate={handleResizeBox}
                onResizeEnd={handleResizeEnd}
                label={box.label} 
              />
            ))}
            <Animated.View style={animatedDrawingStyle} />
          </Animated.View>
        </PanGestureHandler>
        <View style={styles.controlsContainer}>
          <View style={styles.buttonContainer}>
            <Button title="Reset Boxes" onPress={handleResetBoxes} />
          </View>
          <View style={styles.buttonContainer}>
            <Button title="Done" onPress={handleDone} /> 
          </View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 10,
    alignItems: 'center',
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
  },
  contentCentered: { 
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20, 
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1, 
  },
  image: {
    width: '100%',
    height: '100%', 
  },
  controlsContainer: {
    paddingVertical: Platform.OS === 'android' ? 20 : 10, // More padding on Android
    paddingHorizontal: 20,
    borderTopWidth: 1, 
    borderTopColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff', // Ensure buttons are visible
    marginBottom: Platform.OS === 'android' ? 20 : 0, // Extra margin on Android
  },
  buttonContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
}); 