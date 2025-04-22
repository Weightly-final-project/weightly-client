import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { Link } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import { hooks, ResponseType } from "@/utils/api";
import { ActivityIndicator, Button } from "react-native-paper";
import PredictionItem from "../components/prediction-card";
import AppHeader from "../components/AppHeader";
import { getFiles } from "@/utils/s3";
import { useAuth } from "../utils/AuthContext";
const { useDynmo_getMutation } = hooks;

export default function PredictionListScreen() {
  const dynmo_getMutation = useDynmo_getMutation();
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<
    ResponseType<"dynmo_get"> | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);

  // Use useCallback with empty dependency array to prevent recreation
  const fetchResult = useCallback(() => {
    setLoading(true);

    // Use the authenticated user's username if available, otherwise fallback to guest
    const userId = user?.username || "guest";

    console.log("Fetching predictions for user:", userId);

    dynmo_getMutation.mutate(
      { user: userId },
      {
        onSuccess: (pre) => {
          console.log(`Fetched ${pre.length} raw predictions`);

          if (pre.length === 0) {
            setPredictions([]);
            setLoading(false);
            return;
          }

          // Create a copy of the initial predictions
          let updatedPredictions = [...pre];
          let imageUrlsProcessed = false;
          let annotatedUrlsProcessed = false;

          // Function to update state once both async operations complete
          const updateStateIfComplete = () => {
            if (imageUrlsProcessed && annotatedUrlsProcessed) {
              console.log("All prediction URLs processed, updating state");
              setPredictions(updatedPredictions);
              setLoading(false);
            }
          };

          // Get image URLs
          getFiles(
            pre.map((item) => item.image_s3_uri),
            "weighlty"
          )
            .then((results) => {
              console.log(`Processed ${results.length} image URLs`);

              // Update the predictions with image URLs
              updatedPredictions = updatedPredictions.map((item, index) => ({
                ...item,
                download_image_s3_uri: results[index]?.url,
              }));

              imageUrlsProcessed = true;
              updateStateIfComplete();
            })
            .catch((error) => {
              console.error("Error fetching images:", error);
              imageUrlsProcessed = true;
              updateStateIfComplete();
            });

          // Get annotated image URLs
          getFiles(
            pre.map((item) => item.annotated_s3_uri),
            "weighlty"
          )
            .then((results) => {
              console.log(`Processed ${results.length} annotated image URLs`);

              // Update the predictions with annotated image URLs
              updatedPredictions = updatedPredictions.map((item, index) => ({
                ...item,
                download_annotated_s3_uri: results[index]?.url,
              }));

              annotatedUrlsProcessed = true;
              updateStateIfComplete();
            })
            .catch((error) => {
              console.error("Error fetching annotated images:", error);
              annotatedUrlsProcessed = true;
              updateStateIfComplete();
            });
        },
        onError: (error) => {
          console.error("Error fetching predictions:", error);
          Alert.alert("Error", "Failed to load predictions. Please try again.");
          setLoading(false);
        },
      }
    );
  }, [user?.username]); // Update dependency array to include user

  // Run when component mounts or user changes
  useEffect(() => {
    console.log("Predictions screen mounted or user changed, fetching data");
    fetchResult();
  }, [fetchResult]); // Update dependency array

  const handleRefresh = () => {
    console.log("Manual refresh triggered");
    fetchResult();
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Predictions" />

      <View style={styles.contentContainer}>
        <View style={styles.actionContainer}>
          <Link href="/camera" asChild>
            <Button mode="contained" icon="camera" style={styles.cameraButton}>
              Camera
            </Button>
          </Link>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6200ee" />
            <Text style={styles.loadingText}>Loading predictions...</Text>
          </View>
        ) : predictions && predictions.length > 0 ? (
          <>
            <Text style={styles.pullToRefreshHint}>Pull down to refresh</Text>
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.prediction_id}
              renderItem={({ item }) => {
                return <PredictionItem item={item} />;
              }}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={handleRefresh}
                  colors={["#6200ee"]}
                  tintColor="#6200ee"
                />
              }
            />
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No predictions found</Text>
            <Link href="/camera" asChild>
              <Button mode="contained" icon="plus" style={styles.addButton}>
                Create New Prediction
              </Button>
            </Link>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  contentContainer: {
    flex: 1,
    paddingTop: 16,
  },
  actionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cameraButton: {
    backgroundColor: "#6200ee",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: "#6200ee",
  },
  pullToRefreshHint: {
    textAlign: "center",
    color: "#999",
    fontSize: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
});
