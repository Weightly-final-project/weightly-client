import React, { ReactNode } from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Surface } from "react-native-paper";

interface SurfaceWrapperProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  elevation?: number;
}

/**
 * A wrapper component for Surface that properly handles shadows
 * by separating overflow:hidden from the surface itself.
 * This prevents the warning: "When setting overflow to hidden on Surface
 * the shadow will not be displayed correctly."
 */
export const SurfaceWrapper = ({
  children,
  style,
  contentStyle,
  elevation = 1,
}: SurfaceWrapperProps) => {
  return (
    <Surface style={[styles.surface, { elevation }, style]}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  surface: {
    // Surface should not have overflow: 'hidden'
    // Let it render the shadow properly
  },
  content: {
    // Put overflow: 'hidden' on the content wrapper
    overflow: "hidden",
    // Match border radius from parent
    borderRadius: 8,
  },
});

export default SurfaceWrapper;
