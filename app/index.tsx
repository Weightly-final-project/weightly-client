import {
  FlatList,
  Platform,
  RefreshControl,
  Text,
  View,
  Alert,
} from "react-native";
import { Link } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import { hooks, ResponseType } from "../utils/api";
import { ActivityIndicator, Button } from "react-native-paper";
import PredictionItem from "../components/prediction-card";
import AppHeader from "../components/AppHeader";
import { getFiles } from "../utils/s3";
import { useAuth } from "../utils/AuthContext";
const { useDynmo_getMutation } = hooks;

export default function PredictionListScreen() {
  const dynmo_getMutation = useDynmo_getMutation();
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<
    ResponseType<"dynmo_get"> | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);

  const fetchResult = useCallback(() => {
    setLoading(true);

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

          let updatedPredictions = [...pre];
          let imageUrlsProcessed = false;
          let annotatedUrlsProcessed = false;

          const updateStateIfComplete = () => {
            if (imageUrlsProcessed && annotatedUrlsProcessed) {
              console.log("All prediction URLs processed, updating state");
              setPredictions(updatedPredictions);
              setLoading(false);
            }
          };

          getFiles(
            pre.map((item) => item.image_s3_uri),
            "weighlty"
          )
            .then((results) => {
              console.log(`Processed ${results.length} image URLs`);

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

          getFiles(
            pre.map((item) => item.annotated_s3_uri),
            "weighlty"
          )
            .then((results) => {
              console.log(`Processed ${results.length} annotated image URLs`);

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
  }, [user?.username]);

  useEffect(() => {
    console.log("Predictions screen mounted or user changed, fetching data");
    fetchResult();
  }, [fetchResult]);

  const handleRefresh = () => {
    console.log("Manual refresh triggered");
    fetchResult();
  };

  return (
    <View className="flex-1 bg-[#121212]">
      <AppHeader title="Predictions" />

      <View className="flex-1 pt-4">
        <View className="px-4 pb-4 flex-row justify-end">
          <Link href="/camera" asChild>
            <Button mode="contained" icon="camera" className="bg-[#6200ee]">
              Camera
            </Button>
          </Link>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#6200ee" />
            <Text className="mt-4 text-base text-[#666]">Loading predictions...</Text>
          </View>
        ) : predictions && predictions.length > 0 ? (
          <>
            <Text className="text-center text-[#999] text-xs pb-2 px-4">
              Pull down to refresh
            </Text>
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.prediction_id}
              renderItem={({ item }) => (
                <PredictionItem
                  item={item}
                  onDelete={() => {
                    setPredictions((prev) =>
                      prev?.filter((p) => p.prediction_id !== item.prediction_id)
                    );
                  }}
                />
              )}
              className="px-4 py-2"
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
          <View className="flex-1 justify-center items-center p-6">
            <Text className="text-lg text-[#666] mb-6">No predictions found</Text>
            <Link href="/camera" asChild>
              <Button mode="contained" icon="plus" className="bg-[#6200ee]">
                Create New Prediction
              </Button>
            </Link>
          </View>
        )}
      </View>
    </View>
  );
}
