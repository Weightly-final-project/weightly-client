import React, { useCallback } from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Icon } from "react-native-elements";
import ImagePickerExample from "./pickImage";
import { CameraCapturedPicture } from "expo-camera";
import { Split } from "../app/features/camera/types";

const CameraControls = ({
  onCapture,
  onPickImage,
  isProcessing,
  setSplits,
  splits,
  isOrientationValid,
}: {
  onCapture: () => void;
  onPickImage: (photo: CameraCapturedPicture | undefined) => void;
  isProcessing: boolean;
  setSplits: React.Dispatch<React.SetStateAction<Split>>;
  splits: Split;
  isOrientationValid: boolean;
}) => {

  const handleXSplitsChange = useCallback(
    (newValue: number) => {
      setSplits((prevSplits) => ({ ...prevSplits, x_splits: newValue }));
    },
    [setSplits]
  );

  const handleYSplitsChange = useCallback(
    (newValue: number) => {
      setSplits((prevSplits) => ({ ...prevSplits, y_splits: newValue }));
    },
    [setSplits]
  );

  const handleConfidenceThresholdChange = useCallback(
    (newValue: number) => {
      setSplits((prevSplits) => ({ ...prevSplits, confidenceThreshold: newValue }));
    },
    [setSplits]
  );

  return (
    <View style={styles.cameraControls}>
      <TouchableOpacity
        style={[styles.galleryButton, {
          transform: isOrientationValid ? [{ rotate: "90deg" }] : [{ rotate: "0deg" }],
        }]}
        disabled={isProcessing}
      >
        <ImagePickerExample processImage={onPickImage} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.captureButton, {
          transform: isOrientationValid ? [{ rotate: "90deg" }] : [{ rotate: "0deg" }],
        }]}
        onPress={onCapture}
        disabled={isProcessing}
      >
        <Icon name="camera" type="font-awesome" color="#FFF" size={24} />
      </TouchableOpacity>

      <View style={[styles.stepperContainer, {
        flexDirection: isOrientationValid ? "row" : "column",
      }]} >
        <View style={[styles.stepperRow, {
          flexDirection: isOrientationValid ? "column" : "row",
          transform: isOrientationValid ? [{ rotate: "90deg" }] : [{ rotate: "0deg" }],
          width: isOrientationValid ? 60 : 100,
        }]}>
          <Text style={styles.stepperLabel}>Rows: {splits.x_splits}</Text>
          <View style={[styles.stepperButtons, {
            paddingLeft: isOrientationValid ? 0 : 10,
          }]}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => handleXSplitsChange(Math.max(1, splits.x_splits - 1))}
            >
              <Text style={styles.stepperButtonText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => handleXSplitsChange(splits.x_splits + 1)}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.stepperRow, {
          flexDirection: isOrientationValid ? "column" : "row",
          transform: isOrientationValid ? [{ rotate: "90deg" }] : [{ rotate: "0deg" }],
          width: isOrientationValid ? 60 : 100,
        }]}>
          <Text style={styles.stepperLabel}>Cols: {splits.y_splits}</Text>
          <View style={[styles.stepperButtons, {
            paddingLeft: isOrientationValid ? 0 : 20
          }]}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => handleYSplitsChange(Math.max(1, splits.y_splits - 1))}
            >
              <Text style={styles.stepperButtonText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => handleYSplitsChange(splits.y_splits + 1)}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.stepperRow, {
          flexDirection: isOrientationValid ? "column" : "row",
          transform: isOrientationValid ? [{ rotate: "90deg" }] : [{ rotate: "0deg" }],
          width: isOrientationValid ? 60 : 100,
        }]}>
          <Text style={styles.stepperLabel}>Conf: {Math.round(splits.confidenceThreshold*100)}%  </Text>
          <View style={styles.stepperButtons}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => handleConfidenceThresholdChange(Math.max(0.1, splits.confidenceThreshold - 0.1))}
            >
              <Text style={styles.stepperButtonText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => handleConfidenceThresholdChange(Math.min(1.0, splits.confidenceThreshold + 0.1))}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    width: "100%",
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
  stepperContainer: {
    alignItems: "center",
    marginHorizontal: 5, // Added horizontal margin
    marginVertical: -15, // Added vertical margin
  },
  stepperRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  stepperLabel: {
    fontSize: 12,
    marginBottom: 5,
    color: "white", // Added color for better visibility
  },
  stepperButtons: {
    flexDirection: "row",
  },
  stepperButton: {
    width: 25, // Reduced button size
    height: 25, // Reduced button size
    borderRadius: 12.5, // Reduced button size
    backgroundColor: "rgba(255, 255, 255, 0.3)", // Slightly darker background
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2, // Added horizontal margin between buttons
  },
  stepperButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default CameraControls;
