import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Link, useRouter } from "expo-router";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { hooks, ResponseType } from "../utils/api";
import { ActivityIndicator, Button } from "react-native-paper";
import PredictionItem from "../components/prediction-card";
import AppHeader from "../components/AppHeader";
import { getFiles } from "../utils/s3";
import { useAuth } from "../utils/AuthContext";
const { useDynmo_getMutation } = hooks;

export default function PredictionListScreen() {
  const dynmo_getMutation = useDynmo_getMutation();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [predictions, setPredictions] = useState<
    ResponseType<"dynmo_get"> | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);
  const [fetchInProgress, setFetchInProgress] = useState(false);
  const initialFetchCompleted = useRef(false);
  
  // Memoize userId so it's stable between renders
  const userId = useMemo(() => 
    user?.username || "guest", 
    [user?.username]
  );

  // Use useCallback with stable dependencies to prevent recreation on every render
  const fetchResult = useCallback(() => {
    if (authLoading || fetchInProgress) {
      console.log("Auth still loading or fetch in progress, delaying fetch");
      return;
    }
    
    setFetchInProgress(true);
    setLoading(true);
    console.log("Fetching predictions for user:", userId);

    dynmo_getMutation.mutate(
      { user: userId },
      {
        onSuccess: (pre) => {
          console.log(`Fetched ${pre.length} raw predictions`);

          if (pre.length === 0) {
            setPredictions([]);
            setLoading(false);
            setFetchInProgress(false);
            initialFetchCompleted.current = true;
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
              setFetchInProgress(false);
              initialFetchCompleted.current = true;
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
          setFetchInProgress(false);
          initialFetchCompleted.current = true;
        },
      }
    );
  }, [dynmo_getMutation, userId, authLoading, fetchInProgress]);

  // Single useEffect to run once when auth is ready or when userId changes
  useEffect(() => {
    // Only fetch if auth is ready, no fetch is in progress, and we haven't completed the initial fetch
    if (!authLoading && !fetchInProgress && !initialFetchCompleted.current) {
      console.log("Auth ready, fetching predictions. User:", userId);
      fetchResult();
    }
  }, [authLoading, userId, fetchResult, fetchInProgress]);

  const handleRefresh = () => {
    console.log("Manual refresh triggered");
    // Reset the ref if we want to manually refresh
    fetchResult();
  };

  const handleCameraPress = () => {
    Alert.alert(
      "Choose Processing Method",
      "How would you like to process your object?",
      [
        {
          text: "AI Flow",
          onPress: () => {
            router.push({
              pathname: "/camera",
              params: { mode: "ai" }
            });
          }
        },
        {
          text: "Manual Flow",
          onPress: () => {
            router.push({
              pathname: "/camera",
              params: { mode: "manual" }
            });
          }
        }
      ]
    );
  };

  // Show loading indicator while authentication is checking
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Checking authentication...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Predictions" />

      <View style={styles.contentContainer}>
        <View style={styles.actionContainer}>
          <TouchableOpacity onPress={handleCameraPress}>
            <Button mode="contained" icon="camera" style={styles.cameraButton}>
              Camera
            </Button>
          </TouchableOpacity>
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
                return (
                  <PredictionItem
                    item={item}
                    onDelete={() => {
                      // Remove the deleted prediction from the state
                      setPredictions((prev) =>
                        prev?.filter((p) => p.prediction_id !== item.prediction_id)
                      );
                    }}
                  />
                );
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
