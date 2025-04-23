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
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Card, Chip, Divider } from "react-native-paper";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { hooks } from "@/utils/api";
import { Icon } from "react-native-elements";
import { Buffer } from "buffer";
import weight_mapping from "@/utils/weight_mapping";
import {
  getFilenameFromS3Uri,
  formatDate,
  totalVolumeCalculator,
  avarageSizeCalculator,
} from "@/utils/functions";
import { useAuth } from "@/utils/AuthContext";

const { useDynmo_createMutation } = hooks;

export default function PredictionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dynamoCreateMutation = useDynmo_createMutation();
  const { user } = useAuth();
  const userId = user?.username || "guest";

  const { item, predictions } = params;
  const {
    prediction_id,
    created_at,
    updated_at,
    image_s3_uri,
    annotated_s3_uri,
    download_image_s3_uri,
    download_annotated_s3_uri,
  } = JSON.parse(Buffer.from(item as string, "base64").toString("utf-8"));
  const imageUrl = download_annotated_s3_uri as string;

  const parsedPredictions = useMemo(
    () =>
      predictions
        ? JSON.parse(predictions as string)?.filter(
            (item: any) => item.class === "pine"
          )
        : [],
    [predictions]
  );
  console.log(parsedPredictions);
  const woodCount = useMemo(() => {
    return parsedPredictions.length;
  }, [parsedPredictions]);

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
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = useCallback(() => {
    setRefreshing(true);

    // Reload all data
    setTotalVolume(totalVolumeCalculator(parsedPredictions));
    setAvarageSize(avarageSizeCalculator(parsedPredictions));

    // Simulate a delay for the refresh animation
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, [parsedPredictions]);

  useEffect(() => {
    setTotalVolume(totalVolumeCalculator(parsedPredictions));
    setAvarageSize(avarageSizeCalculator(parsedPredictions));
  }, [predictions]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color="#fff" size={24} />
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
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.image} />
          <View style={styles.pointInstructions}>
            <Text style={styles.pointInstructionsText}>
              total volume(m3): {(totalVolume / 1000000).toFixed(3)}
            </Text>
            <Text style={styles.pointInstructionsText}>
              weight (kg): {(totalVolume * weight_mapping.pine) / 1000}
            </Text>
            <Text style={styles.pointInstructionsText}>
              size (cm):{" "}
              {Object.values(avarageSize)
                .map((item) => item.toFixed(3))
                .join("X")}
            </Text>
            <Text style={styles.pointInstructionsText}>
              wood count: {woodCount}
            </Text>
          </View>
          <View style={styles.imageOverlay}>
            <Chip
              icon="image"
              style={styles.fileChip}
              textStyle={styles.chipText}
            >
              {typeof image_s3_uri === "string"
                ? getFilenameFromS3Uri(image_s3_uri)
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
          </View>

          <Divider style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Storage Information</Text>

            <Card style={styles.storageCard}>
              <View style={styles.storageCardContent}>
                <Card.Content>
                  <Text style={styles.storageLabel}>Image S3 URI:</Text>
                  <Text style={styles.storageValue} selectable>
                    {image_s3_uri}
                  </Text>
                </Card.Content>
              </View>
            </Card>

            <Card style={styles.storageCard}>
              <View style={styles.storageCardContent}>
                <Card.Content>
                  <Text style={styles.storageLabel}>Annotated S3 URI:</Text>
                  <Text style={styles.storageValue} selectable>
                    {annotated_s3_uri}
                  </Text>
                </Card.Content>
              </View>
            </Card>
          </View>
          <Divider style={styles.divider} />

          <View style={styles.statusBar}>
            <Text style={styles.statusText}>{pictureStatus}</Text>
          </View>

          {(prediction_id as string).split("_")[0] === "temp" && (
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
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 8,
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
    objectFit: "cover",
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
});
