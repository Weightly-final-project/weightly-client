import React, { ReactNode } from "react";
import { View, StyleProp, ViewStyle } from "react-native";
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
    <Surface style={[{ elevation }, style]}>
      <View className="overflow-hidden rounded-lg" style={contentStyle}>{children}</View>
    </Surface>
  );
};

export default SurfaceWrapper;
