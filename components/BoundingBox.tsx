import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, Text } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  // useSharedValue, // Not needed directly in ResizeHandle if passing initial values
  runOnJS,
} from 'react-native-reanimated';

export interface ResizeHandleProps {
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  boxId: string;
  initialBoxX: number;
  initialBoxY: number;
  initialBoxWidth: number;
  initialBoxHeight: number;
  onResizeStart?: (id: string) => void; // New
  onResizeUpdate: (id: string, newBox: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (id: string) => void; // New
  minWidth?: number;
  minHeight?: number;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({
  position,
  boxId,
  initialBoxX,
  initialBoxY,
  initialBoxWidth,
  initialBoxHeight,
  onResizeStart,
  onResizeUpdate,
  onResizeEnd,
  minWidth = 10,
  minHeight = 10,
}) => {
  const handleSize = 20;

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, {
    // Context for the gesture handler to store initial values from the moment the gesture starts
    startBoxX_ctx: number;
    startBoxY_ctx: number;
    startBoxWidth_ctx: number;
    startBoxHeight_ctx: number;
  }>({
    onStart: (event, ctx) => {
      // console.log(`[ResizeHandle:${position}] onStart for box ${boxId}`);
      ctx.startBoxX_ctx = initialBoxX;
      ctx.startBoxY_ctx = initialBoxY;
      ctx.startBoxWidth_ctx = initialBoxWidth;
      ctx.startBoxHeight_ctx = initialBoxHeight;
      if (onResizeStart) {
        runOnJS(onResizeStart)(boxId);
      }
    },
    onActive: (event, ctx) => {
      let newX = ctx.startBoxX_ctx;
      let newY = ctx.startBoxY_ctx;
      let newWidth = ctx.startBoxWidth_ctx;
      let newHeight = ctx.startBoxHeight_ctx;

      const deltaX = event.translationX;
      const deltaY = event.translationY;

      // console.log(`[ResizeHandle:${position}] RAW EVENT: transX=${event.translationX.toFixed(2)}, transY=${event.translationY.toFixed(2)}`);
      // console.log(`[ResizeHandle:${position}] CTX values: X=${ctx.startBoxX_ctx.toFixed(2)}, Y=${ctx.startBoxY_ctx.toFixed(2)}, W=${ctx.startBoxWidth_ctx.toFixed(2)}, H=${ctx.startBoxHeight_ctx.toFixed(2)}`);
      // console.log(`[ResizeHandle:${position}] Before ALL calc: newX=${newX.toFixed(2)}, newY=${newY.toFixed(2)}, newW=${newWidth.toFixed(2)}, newH=${newHeight.toFixed(2)}`);

      const lowerCasePosition = position.toLowerCase();

      if (lowerCasePosition.includes('right')) {
        newWidth = Math.max(minWidth, ctx.startBoxWidth_ctx + deltaX);
      }
      if (lowerCasePosition.includes('left')) {
        const proposedWidth = ctx.startBoxWidth_ctx - deltaX;
        if (proposedWidth >= minWidth) {
          newWidth = proposedWidth;
          newX = ctx.startBoxX_ctx + deltaX;
        } else {
          newWidth = minWidth;
          newX = ctx.startBoxX_ctx + ctx.startBoxWidth_ctx - minWidth;
        }
      }
      // console.log(`[ResizeHandle:${position}] After X-calc: newX=${newX.toFixed(2)}, newW=${newWidth.toFixed(2)}`);
      // console.log(`[ResizeHandle:${position}] Before Y-calc (current newY, newH): newY=${newY.toFixed(2)}, newH=${newHeight.toFixed(2)} (deltaY: ${deltaY.toFixed(2)})`);

      if (lowerCasePosition.includes('bottom')) {
        newHeight = Math.max(minHeight, ctx.startBoxHeight_ctx + deltaY);
        // console.log(`[ResizeHandle:${position}, Bottom] Applied deltaY. newH: ${newHeight.toFixed(2)}`);
      }
      if (lowerCasePosition.includes('top')) {
        const proposedHeight = ctx.startBoxHeight_ctx - deltaY;
        // console.log(`[ResizeHandle:${position}, Top] proposedH: ${proposedHeight.toFixed(2)} (startH: ${ctx.startBoxHeight_ctx.toFixed(2)}, deltaY: ${deltaY.toFixed(2)})`);
        if (proposedHeight >= minHeight) {
          newHeight = proposedHeight;
          newY = ctx.startBoxY_ctx + deltaY;
          // console.log(`[ResizeHandle:${position}, Top] >=minH path. newY: ${newY.toFixed(2)}, newH: ${newHeight.toFixed(2)}`);
        } else {
          newHeight = minHeight;
          newY = ctx.startBoxY_ctx + (ctx.startBoxHeight_ctx - minHeight);
          // console.log(`[ResizeHandle:${position}, Top] <minH path. newY: ${newY.toFixed(2)}, newH: ${newHeight.toFixed(2)}`);
        }
      }
      // console.log(`[ResizeHandle:${position}] After Y-calc: newY=${newY.toFixed(2)}, newH=${newHeight.toFixed(2)}`);
      // console.log(`[ResizeHandle:${position}] FINAL to onResizeUpdate: X=${newX.toFixed(2)}, Y=${newY.toFixed(2)}, W=${newWidth.toFixed(2)}, H=${newHeight.toFixed(2)}`);
      
      runOnJS(onResizeUpdate)(boxId, { x: newX, y: newY, width: newWidth, height: newHeight });
    },
    onEnd: () => {
      // console.log(`[ResizeHandle:${position}] onEnd for box ${boxId}`);
      if (onResizeEnd) {
        runOnJS(onResizeEnd)(boxId);
      }
    },
    onCancel: () => { // Also call onResizeEnd on cancel
      // console.log(`[ResizeHandle:${position}] onCancel for box ${boxId}`);
      if (onResizeEnd) {
        runOnJS(onResizeEnd)(boxId);
      }
    },
    onFail: () => { // Also call onResizeEnd on fail
      // console.log(`[ResizeHandle:${position}] onFail for box ${boxId}`);
      if (onResizeEnd) {
        runOnJS(onResizeEnd)(boxId);
      }
    }
  });

  let style: ViewStyle = {
    position: 'absolute',
    width: handleSize,
    height: handleSize,
    backgroundColor: 'rgba(0,0,255,0.7)',
    borderRadius: handleSize / 2,
    zIndex: 10, 
  };

  switch (position) {
    case 'topLeft': style.left = -handleSize / 2; style.top = -handleSize / 2; break;
    case 'topRight': style.right = -handleSize / 2; style.top = -handleSize / 2; break;
    case 'bottomLeft': style.left = -handleSize / 2; style.bottom = -handleSize / 2; break;
    case 'bottomRight': style.right = -handleSize / 2; style.bottom = -handleSize / 2; break;
  }

  return (
    <PanGestureHandler 
        onGestureEvent={gestureHandler}
        // Optional: to make handles more responsive if they are small
        // activeOffsetX={[-5, 5]}
        // activeOffsetY={[-5, 5]}
    >
      <Animated.View style={style} />
    </PanGestureHandler>
  );
};


interface BoundingBoxProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  onResizeStart?: (id: string) => void; 
  onResizeUpdate: (id: string, newBox: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (id: string) => void; 
  label?: string;
}

const BoundingBox: React.FC<BoundingBoxProps> = ({ 
  id,
  x, 
  y, 
  width, 
  height, 
  borderColor = 'red', 
  borderWidth = 2, 
  backgroundColor = 'transparent',
  onSelect, 
  isSelected = false,
  onResizeStart,
  onResizeUpdate,
  onResizeEnd,
  label,
}) => {
  const boxStyle: ViewStyle = {
    position: 'absolute',
    left: x,
    top: y,
    width: width,
    height: height,
    borderWidth: borderWidth,
    borderColor: borderColor,
    backgroundColor: backgroundColor,
  };

  const handlePress = () => {
    // The check for active resize will now be primarily handled by EditImageScreen's logic
    // by not calling onSelect if a resize is in progress.
    if (onSelect) { 
      // console.log(`[BoundingBox] Press on box ${id}, isSelected: ${isSelected}`);
      onSelect(id);
    }
  };

  if (width <= 0 || height <= 0) {
    return null;
  }
  
  return (
    <View style={boxStyle}> 
      {label && (
        <Text style={[
          styles.label,
          { color: borderColor }
        ]}>
          {label}
        </Text>
      )}
      <Pressable onPress={handlePress} style={{ flex: 1, width: '100%', height: '100%' }} />
      {isSelected && (
        <>
          <ResizeHandle 
            position="topLeft" boxId={id} 
            initialBoxX={x} initialBoxY={y} initialBoxWidth={width} initialBoxHeight={height}
            onResizeStart={onResizeStart} onResizeUpdate={onResizeUpdate} onResizeEnd={onResizeEnd} />
          <ResizeHandle 
            position="topRight" boxId={id} 
            initialBoxX={x} initialBoxY={y} initialBoxWidth={width} initialBoxHeight={height}
            onResizeStart={onResizeStart} onResizeUpdate={onResizeUpdate} onResizeEnd={onResizeEnd} />
          <ResizeHandle 
            position="bottomLeft" boxId={id} 
            initialBoxX={x} initialBoxY={y} initialBoxWidth={width} initialBoxHeight={height}
            onResizeStart={onResizeStart} onResizeUpdate={onResizeUpdate} onResizeEnd={onResizeEnd} />
          <ResizeHandle 
            position="bottomRight" boxId={id} 
            initialBoxX={x} initialBoxY={y} initialBoxWidth={width} initialBoxHeight={height}
            onResizeStart={onResizeStart} onResizeUpdate={onResizeUpdate} onResizeEnd={onResizeEnd} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    top: -20,
    left: 0,
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 3,
  }
});

export default React.memo(BoundingBox); 