import React from "react";
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
} from "react-native";
import { Icon } from "react-native-elements";

interface ImagePreviewProps {
  imageUri: string;
  isProcessing: boolean;
  onRetake: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  imageUri,
  isProcessing,
  onRetake,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onRetake}>
          <Icon name="arrow-back" type="material" color="white" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Front View</Text>
        <View></View>
      </View>

      <View style={styles.imageContainer}>
        {!isProcessing &&
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        }
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, isProcessing && styles.disabledButton]}
          disabled={isProcessing}
          onPress={onRetake}
        >
          <Icon name="refresh" type="material" color="white" size={24} />
          <Text style={styles.actionBtnText}>Retake</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: "#202020",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#202020",
  },
  previewImage: {
    width: "100%",
    height: "70%",
    resizeMode: "cover",
  },
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "#202020",
  },
  actionBtn: {
    backgroundColor: "#333333",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
  },
  actionBtnText: {
    color: "white",
    fontWeight: "bold",
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#202020",
    height: "70%",
  },
  loadingText: {
    color: "white",
    marginTop: 16,
    textAlign: "center",
  },
});

export default ImagePreview;
