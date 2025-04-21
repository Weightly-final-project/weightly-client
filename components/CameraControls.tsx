import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "react-native-elements";
import ImagePickerExample from "./pickImage";

const CameraControls = ({
  onCapture,
  onPickImage,
  isProcessing,
}: {
  onCapture: () => void;
  onPickImage: () => void;
  isProcessing: boolean;
}) => {
  return (
    <View style={styles.cameraControls}>
      <TouchableOpacity
        style={styles.galleryButton}
        onPress={onPickImage}
        disabled={isProcessing}
      >
        <ImagePickerExample processImage={onPickImage} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.captureButton}
        onPress={onCapture}
        disabled={isProcessing}
      >
        <View style={styles.captureButtonInner} />
      </TouchableOpacity>

      <View style={styles.placeholderButton} />
    </View>
  );
};

const styles = StyleSheet.create({
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 30,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#121212",
  },
  placeholderButton: {
    width: 50,
    height: 50,
  },
});

export default CameraControls;
