import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  GestureResponderEvent,
  TouchableWithoutFeedback,
  Alert,
  Image,
  RefreshControl,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Checkbox from 'expo-checkbox';
import { Card, Chip, Divider } from "react-native-paper";
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { hooks } from "../utils/api";
import { Icon } from "react-native-elements";
import { Buffer } from "buffer";
import weight_mapping from "../utils/weight_mapping";
import {
  getFilenameFromS3Uri,
  formatDate,
  convertToStandartSize,
} from "../utils/functions";
import { useAuth } from "../utils/AuthContext";
import { set } from "date-fns";

const { useDynmo_createMutation } = hooks;

// Utility function to convert S3 URIs to HTTPS URLs
const getProperImageUrl = (uri: string | null | undefined): string | null => {
  if (!uri) return null;

  // Check if it's an S3 URI
  if (uri.startsWith('s3://')) {
    // Convert s3://bucket/key to https://bucket.s3.amazonaws.com/key
    const withoutProtocol = uri.substring(5); // Remove 's3://'
    const parts = withoutProtocol.split('/');
    const bucket = parts[0];
    const key = parts.slice(1).join('/');
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }

  // If it's already an HTTP URL, return as is
  return uri;
};

export default function PredictionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dynamoCreateMutation = useDynmo_createMutation();
  const { user, isLoading: authLoading } = useAuth();
  const userId = useMemo(() => {
    return authLoading ? "loading" : (user?.username || "guest");
  }, [authLoading, user]);

  // Use refs to track initialization and prevent infinite loops
  const isInitialized = useRef(false);

  const { item, predictions } = params;
  const itemData = useMemo(() => {
    try {
      return JSON.parse(Buffer.from(item as string, "base64").toString("utf-8"));
    } catch (error) {
      console.error("Failed to parse item data:", error);
      return { photos: [] };
    }
  }, [item]);

  const {
    prediction_id,
    created_at,
    updated_at,
    image_s3_uri,
    annotated_s3_uri,
    download_image_s3_uri,
    download_annotated_s3_uri,
    photos = [], // Include photos array
  } = itemData;
  // State for image carousel
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Parse the predictions and get all dimensions
  const parsedPredictions = useMemo(() => {
    try {
      return predictions
        ? JSON.parse(predictions as string)?.filter(
          (item: any) => item.class === "pine"
        ) || []
        : [];
    } catch (error) {
      console.error("Failed to parse predictions:", error);
      return [];
    }
  }, [predictions]);

  const [pictureStatus, setPictureStatus] = useState<string>("Ready to save");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [totalVolume, setTotalVolume] = useState<number>(0.0);
  const [avarageSize, setAvarageSize] = useState<{
    width_cm: number;
    height_cm: number;
    length_cm: number;
  }>({
    width_cm: 0.0,
    height_cm: 0.0,
    length_cm: 0.0,
  });
  const [standartFlag, setStandartFlag] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);

  // Determine which image to show based on active index and convert S3 URIs
  const activeImage = useMemo(() => {
    let imageUri;

    if (photos && photos.length > 0 && activePhotoIndex < photos.length) {
      imageUri = photos[activePhotoIndex].download_annotated_s3_uri ||
        photos[activePhotoIndex].annotated_s3_uri;
    }

    if (!imageUri) {
      imageUri = download_annotated_s3_uri;
    }

    // Convert S3 URI to proper HTTPS URL
    return getProperImageUrl(imageUri);
  }, [photos, activePhotoIndex, download_annotated_s3_uri]);
  
  const woodCount = useMemo(() => {
    if (photos && photos.length > 0 && activePhotoIndex < photos.length) {
      return photos[activePhotoIndex].predictions.length - 1 || 0;
    }
    return 0;
  }, [activePhotoIndex, photos]);

  // Log user once when component mounts or auth state changes
  useEffect(() => {
    if (!authLoading) {
      console.log("Prediction screen using user:", userId);
    }
  }, [authLoading, userId]);

  // Improved size calculation that prioritizes non-zero values from predictions
  const calculateSizes = useCallback(() => {
    if (!parsedPredictions || parsedPredictions.length === 0) return;

    // Best estimates from the predictions
    let bestWidth = 0;
    let bestHeight = 0;
    let bestLength = 0;

    // Extract best measurements, prioritizing non-zero values
    parsedPredictions.forEach((prediction: any) => {
      if (prediction.width_cm && prediction.width_cm > bestWidth) {
        bestWidth = prediction.width_cm;
      }
      if (prediction.height_cm && prediction.height_cm > bestHeight) {
        bestHeight = prediction.height_cm;
      }
      if (prediction.length_cm && prediction.length_cm > bestLength) {
        bestLength = prediction.length_cm;
      }
    });

    // If we have two images, use them to improve dimension calculation
    if (photos && photos.length >= 2) {
      // Top-down view provides best width and height
      const topDownPreds = photos[0]?.predictions || [];
      // Horizontal view provides best depth/length
      const horizontalPreds = photos[1]?.predictions || [];

      // Extract measurements from top-down view (if available)
      topDownPreds.forEach((pred: any) => {
        if (pred.width_cm && pred.width_cm > 0) bestWidth = pred.width_cm;
        if (pred.height_cm && pred.height_cm > 0) bestHeight = pred.height_cm;
      });

      // Extract measurements from horizontal view (if available)
      horizontalPreds.forEach((pred: any) => {
        if (pred.width_cm && pred.width_cm > 0) bestLength = pred.width_cm;
      });
    }

    if (standartFlag) {
      // Convert to standard size
      const standartSize = convertToStandartSize({
        width_cm: bestWidth,
        height_cm: bestHeight,
        length_cm: bestLength,
      });
      bestWidth = standartSize.width_cm;
      bestHeight = standartSize.height_cm;
      bestLength = standartSize.length_cm;
    }

    // Calculate total volume (use existing utility)
    const newTotalVolume = bestWidth * bestHeight * bestLength;

    // Update state with batched updates to prevent excessive re-renders
    setTotalVolume(newTotalVolume);
    setAvarageSize({
      width_cm: bestWidth,
      height_cm: bestHeight,
      length_cm: bestLength,
    });
  }, [parsedPredictions, photos, standartFlag])

  // Run calculations only once on mount and when dependencies change
  useEffect(() => {
    // Only calculate sizes if not already initialized or during a refresh
    if (!isInitialized.current || refreshing) {
      calculateSizes();
      isInitialized.current = true;
    }
  }, [calculateSizes, refreshing]);

  useEffect(() => {
    calculateSizes();
  }, [calculateSizes, standartFlag]);

  const saveResults = async () => {
    try {
      setPictureStatus("Saving results...");
      setIsProcessing(true);

      const result = await dynamoCreateMutation.mutateAsync({
        ...{
          image_s3_uri: image_s3_uri as string,
          annotated_s3_uri: annotated_s3_uri as string,
          predictions: parsedPredictions,
        },
        user: userId,
      });

      setPictureStatus("Results saved successfully!");

      setIsProcessing(false);
      router.replace({
        pathname: "/prediction",
        params: {
          item: Buffer.from(
            JSON.stringify({
              prediction_id: result.prediction_id,
              user: userId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              image_s3_uri: image_s3_uri,
              annotated_s3_uri: annotated_s3_uri,
              download_image_s3_uri: download_image_s3_uri,
              download_annotated_s3_uri: download_annotated_s3_uri,
              photos: photos, // Keep the photos array
            })
          ).toString("base64"),
          predictions: predictions,
        },
      });
    } catch (error) {
      console.error(error);
      setPictureStatus("Error saving results");
      Alert.alert(
        "Save Error",
        "There was an error saving your results. Please try again.",
        [{ text: "OK" }]
      );
      setIsProcessing(false);
    }
  };

  const handleCheckboxPress = useCallback(() => {
    setStandartFlag((prev) => !prev);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    calculateSizes(); // Use our improved calculation
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, [calculateSizes]);

  // Function to format size as cm (with fallback)
  const formatSize = (value: number) => {
    if (!value || value <= 0) return "N/A";
    return `${value.toFixed(2)} cm`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Icon name="arrow-back" type="material" color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prediction Details</Text>
        <View></View>
      </View>

      <Text style={styles.pullToRefreshHint}>Pull down to refresh</Text>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#6200ee"]}
            tintColor="#6200ee"
          />
        }
      >
        {/* Photo Selector */}
        {photos && photos.length > 1 && (
          <View style={styles.photoSelector}>
            <TouchableOpacity
              style={[
                styles.photoSelectorButton,
                activePhotoIndex === 0 ? styles.activePhotoButton : {}
              ]}
              onPress={() => setActivePhotoIndex(0)}
            >
              <Text style={styles.photoButtonText}>Top-Down View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.photoSelectorButton,
                activePhotoIndex === 1 ? styles.activePhotoButton : {}
              ]}
              onPress={() => setActivePhotoIndex(1)}
            >
              <Text style={styles.photoButtonText}>Horizontal View</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Image */}
        <View style={styles.imageContainer}>
          {activeImage ? (
            <Image
              source={{ uri: activeImage }}
              style={styles.image}
              resizeMode="contain"
              onError={(e) => console.error("Image loading error:", e.nativeEvent.error)}
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderText}>No image available</Text>
            </View>
          )}

          {/* Current image label */}
          <View style={styles.imageTypeOverlay}>
            <Text style={styles.imageTypeText}>
              {activePhotoIndex === 0 ? "Top-Down View" : "Horizontal View"}
            </Text>
          </View>

          {/* Dimensions overlay */}
          <View style={styles.pointInstructions}>
            <Text style={styles.dimensionTitle}>Object Dimensions:</Text>

            <View style={styles.dimensionsGrid}>
              <View style={styles.dimensionItem}>
                <Text style={styles.dimensionLabel}>Width:</Text>
                <Text style={styles.dimensionValue}>{formatSize(avarageSize.width_cm)}</Text>
              </View>

              <View style={styles.dimensionItem}>
                <Text style={styles.dimensionLabel}>Height:</Text>
                <Text style={styles.dimensionValue}>{formatSize(avarageSize.height_cm)}</Text>
              </View>

              <View style={styles.dimensionItem}>
                <Text style={styles.dimensionLabel}>Length:</Text>
                <Text style={styles.dimensionValue}>{formatSize(avarageSize.length_cm)}</Text>
              </View>
            </View>

            <View style={styles.dimensionsRow}>
              <View style={styles.dimensionItem}>
                <Text style={styles.dimensionLabel}>Volume:</Text>
                <Text style={styles.dimensionValue}>
                  {totalVolume > 0 ? `${(totalVolume / 1000000).toFixed(3)} m³` : "N/A"}
                </Text>
              </View>

              <View style={styles.dimensionItem}>
                <Text style={styles.dimensionLabel}>Weight:</Text>
                <Text style={styles.dimensionValue}>
                  {totalVolume > 0 ? `${(totalVolume * weight_mapping.pine / 1000).toFixed(2)} kg` : "N/A"}
                </Text>
              </View>

              <View style={styles.dimensionItem}>
                <Text style={styles.dimensionLabel}>Count:</Text>
                <Text style={styles.dimensionValue}>{woodCount}</Text>
              </View>
            </View>
          </View>

          <View style={styles.imageOverlay}>
            <Chip
              icon="image"
              style={styles.fileChip}
              textStyle={styles.chipText}
            >
              {typeof image_s3_uri === "string"
                ? getFilenameFromS3Uri(photos[activePhotoIndex]?.image_s3_uri || image_s3_uri)
                : "Image"}
            </Chip>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prediction Information</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ID:</Text>
              <Text style={styles.infoValue}>{prediction_id}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>User:</Text>
              <Chip
                icon="account"
                style={styles.userChip}
                textStyle={styles.userChipText}
              >
                {userId}
              </Chip>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created:</Text>
              <Text style={styles.infoValue}>
                {typeof created_at === "string"
                  ? formatDate(created_at)
                  : "Unknown"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Updated:</Text>
              <Text style={styles.infoValue}>
                {typeof updated_at === "string"
                  ? formatDate(updated_at)
                  : "Unknown"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Checkbox
                  value={standartFlag}
                  onValueChange={handleCheckboxPress}
                />
              </View>
              <Text style={styles.infoValue}>Convert To Standart Size</Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Storage Information</Text>

            <Card style={styles.storageCard}>
              <View style={styles.storageCardContent}>
                <Card.Content>
                  <Text style={styles.storageLabel}>Image S3 URI:</Text>
                  <Text style={styles.storageValue} selectable>
                    {photos[activePhotoIndex]?.image_s3_uri || image_s3_uri}
                  </Text>
                </Card.Content>
              </View>
            </Card>

            <Card style={styles.storageCard}>
              <View style={styles.storageCardContent}>
                <Card.Content>
                  <Text style={styles.storageLabel}>Annotated S3 URI:</Text>
                  <Text style={styles.storageValue} selectable>
                    {photos[activePhotoIndex]?.annotated_s3_uri || annotated_s3_uri}
                  </Text>
                </Card.Content>
              </View>
            </Card>
          </View>
          <Divider style={styles.divider} />

          <View style={styles.statusBar}>
            <Text style={styles.statusText}>{pictureStatus}</Text>
          </View>

          {(prediction_id as string)?.split("_")[0] === "temp" && (
            <>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.primaryButton,
                  isProcessing && styles.disabledButton,
                ]}
                disabled={isProcessing}
                onPress={saveResults}
              >
                <Icon name="save" type="material" color="white" size={24} />
                <Text style={styles.actionBtnText}>Save</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  touchableImageContainer: {
    position: "relative",
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
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
  primaryButton: {
    backgroundColor: "#6200ee",
  },
  actionBtnText: {
    color: "white",
    fontWeight: "bold",
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  pointMarker: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(98, 0, 238, 0.8)",
    borderWidth: 2,
    borderColor: "white",
    justifyContent: "center",
    alignItems: "center",
    transform: [{ translateX: -15 }, { translateY: -15 }],
  },
  statusBar: {
    backgroundColor: "#202020",
    padding: 8,
    alignItems: "center",
  },
  statusText: {
    color: "#6200ee",
    fontSize: 14,
  },
  pointNumber: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  pointInstructions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 12,
    alignItems: "center",
  },
  pointInstructionsText: {
    color: "white",
    fontSize: 14,
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: "relative",
    width: width,
    height: height * 0.4,
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    backgroundColor: "#1A1A1A",
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#666',
    fontSize: 16,
  },
  imageOverlay: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  fileChip: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  chipText: {
    fontSize: 12,
    color: "white",
  },
  detailsContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoLabel: {
    width: 80,
    fontSize: 14,
    color: "#999",
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: "white",
  },
  userChip: {
    backgroundColor: "#6200ee",
  },
  userChipText: {
    color: "white",
  },
  divider: {
    backgroundColor: "#333",
    height: 1,
    marginVertical: 16,
  },
  storageCard: {
    backgroundColor: "#2A2A2A",
    marginBottom: 12,
    borderRadius: 8,
  },
  storageCardContent: {
    overflow: "hidden",
    borderRadius: 8,
  },
  storageLabel: {
    fontSize: 14,
    color: "#999",
    marginBottom: 4,
  },
  storageValue: {
    fontSize: 12,
    color: "white",
    fontFamily: "monospace",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 40,
  },
  downloadButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: "#6200ee",
  },
  editButton: {
    flex: 1,
    marginLeft: 8,
    borderColor: "#6200ee",
  },
  pullToRefreshHint: {
    textAlign: "center",
    color: "#999",
    fontSize: 12,
    paddingVertical: 4,
    backgroundColor: "#202020",
  },
  photoSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#202020",
  },
  photoSelectorButton: {
    flex: 1,
    padding: 10,
    margin: 4,
    borderRadius: 8,
    backgroundColor: "#333",
    alignItems: "center",
  },
  activePhotoButton: {
    backgroundColor: "#6200ee",
  },
  photoButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  imageTypeOverlay: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 8,
    borderRadius: 4,
  },
  imageTypeText: {
    color: "white",
    fontWeight: "bold",
  },
  dimensionTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  dimensionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
  },
  dimensionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  dimensionItem: {
    flex: 1,
    alignItems: "center",
  },
  dimensionLabel: {
    color: "#999",
    fontSize: 12,
  },
  dimensionValue: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
});
