import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, SafeAreaView, Text, Dimensions, Button, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import BoundingBox from './components/BoundingBox'; // Import BoundingBox

interface Box {
  id: string; // Added id
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected?: boolean; // Added isSelected
  label: string; // Added label
}

// Get screen dimensions for potential scaling if image is not full screen
// const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Define thresholds for tap vs. pan
const PAN_ACTIVE_OFFSET_THRESHOLD = 15; 
// const PAN_FAIL_OFFSET_THRESHOLD = 5; // Temporarily removed

export default function EditImageScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const router = useRouter(); // Initialize router
  const [boxes, setBoxes] = useState<Box[]>([]);

  useEffect(() => {
    console.log('[EditImageScreen] boxes state changed:', JSON.stringify(boxes), 'Is Array:', Array.isArray(boxes));
    if (imageUri) {
      console.log('[EditImageScreen] imageUri is present:', imageUri);
    } else {
      console.log('[EditImageScreen] imageUri is NOT present.');
    }
  }, [boxes, imageUri]);

  // Shared values for drawing new boxes
  const drawStartX = useSharedValue(0);
  const drawStartY = useSharedValue(0);
  const drawCurrentX = useSharedValue(0);
  const drawCurrentY = useSharedValue(0);
  const isDrawing = useSharedValue(false);

  // Shared values for moving existing boxes
  const isMovingBox = useSharedValue(false);
  const movingBoxId = useSharedValue<string | null>(null);
  const moveGestureStartX = useSharedValue(0); // Gesture's starting X for calculating delta
  const moveGestureStartY = useSharedValue(0); // Gesture's starting Y for calculating delta
  const movingBoxInitialX = useSharedValue(0); // Box's initial X when move starts
  const movingBoxInitialY = useSharedValue(0); // Box's initial Y when move starts

  const isResizingBox = useSharedValue(false); // New state for resizing

  const assignLabel = (existingBoxes: Box[]): string => {
    if (existingBoxes.length === 0) {
      return "Rubkis cube";
    }
    if (existingBoxes.length === 1) {
      // Check if "Rubkis cube" is already used
      const rubkisExists = existingBoxes.some(box => box.label === "Rubkis cube");
      if (!rubkisExists) return "Rubkis cube"; // Should ideally not happen if first is always Rubkis
      return "wood stack";
    }
    return ""; // Should not reach here if limited to 2 boxes
  };

  const addNewBox = (newBoxData: Omit<Box, 'id' | 'isSelected' | 'label'>) => {
    setBoxes(prevBoxes => {
      const currentBoxes = Array.isArray(prevBoxes) ? prevBoxes : [];
      if (currentBoxes.length >= 2) {
        runOnJS(Alert.alert)("Limit Reached", "You can only draw two boxes.");
        return currentBoxes; // Return current boxes without adding
      }

      const label = assignLabel(currentBoxes);

      const newBoxWithIdAndLabel: Box = {
        ...newBoxData,
        id: Date.now().toString() + Math.random().toString(),
        isSelected: false,
        label: label,
      };
      console.log(`[EditImageScreen] Adding new box with label: ${label}`);
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
    // console.log(`[EditImageScreen] handleResizeBox for ${id}:`, JSON.stringify(newBoxData));
    setBoxes(prevBoxes =>
      prevBoxes.map(box =>
        box.id === id ? { ...box, ...newBoxData } : box
      )
    );
  };

  const handleResizeStart = (boxId: string) => {
    console.log(`[EditImageScreen] handleResizeStart for box ${boxId}`);
    isResizingBox.value = true;
    // Potentially deselect other boxes or ensure this one is marked as "active for resize"
    // For now, just setting the flag is enough to block other gestures.
  };

  const handleResizeEnd = (boxId: string) => {
    console.log(`[EditImageScreen] handleResizeEnd for box ${boxId}`);
    isResizingBox.value = false;
    // Here you could finalize the resize, e.g., if you were doing complex calculations
    // or wanted to snap to a grid, etc. For now, onResizeUpdate handles it.
  };

  const handleResetBoxes = () => {
    console.log('[EditImageScreen] Resetting boxes.');
    setBoxes([]);
    isDrawing.value = false; // Also reset gesture states if any active
    isMovingBox.value = false;
    movingBoxId.value = null;
    isResizingBox.value = false; // Reset this too
  };

  const handleDone = () => {
    console.log('[EditImageScreen] Done drawing boxes:', JSON.stringify(boxes));
    // Navigate back to the camera screen, passing the boxes and the original imageUri
    // The camera screen will listen for these params.
    router.replace({
      pathname: '/camera', // Assuming camera screen is at '/camera'
      params: {
        bboxData: JSON.stringify(boxes),
        processedImageUri: imageUri, // Pass back the imageUri this screen was working on
      },
    });
  };

  const handleSelectBox = (selectedId: string) => {
    if (isDrawing.value || isMovingBox.value || isResizingBox.value) { // Check isResizingBox
      console.log('[EditImageScreen] handleSelectBox skipped due to active gesture (draw, move, or resize).');
      return;
    }
    console.log(`[!!! EditImageScreen !!!] handleSelectBox called for id: ${selectedId}`); // Made log more prominent
    setBoxes(prevBoxes => 
      prevBoxes.map(box => ({ 
        ...box, 
        isSelected: box.id === selectedId ? !box.isSelected : false // Toggle selected, deselect others
      }))
    );
    isDrawing.value = false; // Ensure drawing mode is off after selection attempt
  };
  
  const deselectAllBoxes = () => {
    console.log('[EditImageScreen] deselectAllBoxes called');
    setBoxes(prevBoxes => prevBoxes.map(b => ({ ...b, isSelected: false })));
  };

  const _onGestureStartJS = (touchX: number, touchY: number) => {
    // These are reset immediately by the worklet upon gesture start on the UI thread
    // isDrawing.value = false; 
    // isMovingBox.value = false;
    // movingBoxId.value = null; 

    const currentSelectedBoxBeforeGesture = boxes.find(b => b.isSelected);
    console.log('[GestureJS] _onGestureStartJS - currentSelectedBoxBeforeGesture:', currentSelectedBoxBeforeGesture ? currentSelectedBoxBeforeGesture.id : 'none', 'isResizing:', isResizingBox.value);

    if (isResizingBox.value) { // If a resize operation is active, primary PGH should not interfere
        console.log('[GestureJS] _onGestureStartJS - Bailing out: Resize is active.');
        return;
    }

    if (currentSelectedBoxBeforeGesture) {
      if (touchX >= currentSelectedBoxBeforeGesture.x && 
          touchX <= currentSelectedBoxBeforeGesture.x + currentSelectedBoxBeforeGesture.width &&
          touchY >= currentSelectedBoxBeforeGesture.y && 
          touchY <= currentSelectedBoxBeforeGesture.y + currentSelectedBoxBeforeGesture.height) {
        console.log(`[GestureJS] Decided: Start MOVE for box ${currentSelectedBoxBeforeGesture.id}`);
        isMovingBox.value = true;
        isDrawing.value = false; // Ensure draw is off
        movingBoxId.value = currentSelectedBoxBeforeGesture.id;
        moveGestureStartX.value = touchX;
        moveGestureStartY.value = touchY;
        movingBoxInitialX.value = currentSelectedBoxBeforeGesture.x;
        movingBoxInitialY.value = currentSelectedBoxBeforeGesture.y;
      } else {
        console.log('[GestureJS] Decided: Tap off selected box - Deselecting.');
        deselectAllBoxes(); 
        isDrawing.value = false; // Explicitly ensure no drawing starts
        isMovingBox.value = false;
      }
    } else {
      console.log('[GestureJS] Decided: Start DRAW (no box was selected OR resize not active).');
      deselectAllBoxes(); 
      
      isDrawing.value = true; 
      isMovingBox.value = false; // Ensure move is off
      drawStartX.value = touchX;
      drawStartY.value = touchY;
      drawCurrentX.value = touchX;
      drawCurrentY.value = touchY;
    }
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (event) => {
      console.log('[Reanimated] PanGestureHandler onStart -- Event:', event.handlerTag, event.state);
      // Reset worklet states at the very beginning of a new gesture interaction by PanGestureHandler
      if (isResizingBox.value) { // IMPORTANT CHECK
          // console.log('[Reanimated] Main PGH onStart SKIPPED because isResizingBox is true.');
          return; 
      }
      isDrawing.value = false; 
      isMovingBox.value = false;
      movingBoxId.value = null; 
      runOnJS(_onGestureStartJS)(event.x, event.y);
    },
    onActive: (event) => {
      if (isResizingBox.value) return; // Do nothing if resize is active

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
      console.log('[Reanimated] PanGestureHandler onEnd -- Event:', event.handlerTag, event.state);
      if (isResizingBox.value) { // Reset if PGH somehow ends while resize was thought to be active.
          // isResizingBox.value = false; // This should be handled by onResizeEnd
          console.log('[Reanimated] Main PGH onEnd - resize was active, now what? Should be handled by handleResizeEnd.');
          // No action needed here for drawing/moving if resize was active
      } else if (isMovingBox.value) {
        // Position already updated in onActive
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
      // Reset master control shared values, UNLESS a resize is active.
      // The isResizingBox flag itself is reset by its own specific callbacks.
      if (!isResizingBox.value) {
        isDrawing.value = false;
        isMovingBox.value = false;
        movingBoxId.value = null;
      }
    },
    onFail: (event) => {
      console.log('[Reanimated] PanGestureHandler onFail (likely a tap) -- Event:', event.handlerTag, event.state);
      if (!isResizingBox.value) { // Only reset if not in a resize operation
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
    console.log('[EditImageScreen] No imageUri, rendering placeholder.');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.contentCentered}>
          <Text>No image URI provided.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const boxesToRender = Array.isArray(boxes) ? boxes : [];
  if (!Array.isArray(boxes)) {
    console.warn('[EditImageScreen] WARNING: boxes state is NOT an array before render! boxes:', JSON.stringify(boxes));
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Draw Bounding Boxes</Text>
        </View>
        <PanGestureHandler 
          onGestureEvent={gestureHandler}
          activeOffsetX={[-PAN_ACTIVE_OFFSET_THRESHOLD, PAN_ACTIVE_OFFSET_THRESHOLD]}
          activeOffsetY={[-PAN_ACTIVE_OFFSET_THRESHOLD, PAN_ACTIVE_OFFSET_THRESHOLD]}
          // failOffsetX={[-PAN_FAIL_OFFSET_THRESHOLD, PAN_FAIL_OFFSET_THRESHOLD]} // Temporarily removed
          // failOffsetY={[-PAN_FAIL_OFFSET_THRESHOLD, PAN_FAIL_OFFSET_THRESHOLD]} // Temporarily removed
        >
          <Animated.View style={styles.imageContainer}> 
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            {/* Render completed boxes */}
            {boxesToRender.map((box) => (
              <BoundingBox
                key={box.id} // Use id as key
                id={box.id}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                borderColor={box.isSelected ? 'green' : 'red'} // Change color when selected
                borderWidth={box.isSelected ? 3 : 2} // Change border width when selected
                onSelect={handleSelectBox} // Pass selection handler
                isSelected={box.isSelected} // Pass isSelected prop
                onResizeStart={handleResizeStart}
                onResizeUpdate={handleResizeBox}
                onResizeEnd={handleResizeEnd}
                label={box.label} // Pass label to BoundingBox
              />
            ))}
            {/* Render the currently drawing box (preview) */}
            <Animated.View style={animatedDrawingStyle} />
          </Animated.View>
        </PanGestureHandler>
        <View style={styles.controlsContainer}>
          <Button title="Reset Boxes" onPress={handleResetBoxes} />
          <Button title="Done" onPress={handleDone} />
          {/* Add other controls like Save here later */}
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
    borderBottomWidth: 1, // Add a separator
    borderBottomColor: '#eee',
  },
  contentCentered: { // For messages like 'No image URI'
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20, // Adjusted size
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1, // Ensure it takes available space for gesture handling
    // backgroundColor: 'lightgrey', // For debugging layout
  },
  image: {
    width: '100%',
    height: '100%', // Make image fill the container for accurate coordinates
  },
  controlsContainer: {
    padding: 10,
    borderTopWidth: 1, // Add a separator
    borderTopColor: '#eee',
    alignItems: 'center', // Center button if it's the only one
  },
}); 