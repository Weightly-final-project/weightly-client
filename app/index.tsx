import { FlatList, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { hooks, ResponseType } from "@/utils/api";
import { ActivityIndicator, Button } from "react-native-paper";
import PredictionItem from "../components/prediction-card";
import { getFile } from "@/utils/s3";
const {
  useDynmo_getMutation
} = hooks;

export default function CameraScreen() {
  const dynmo_getMutation = useDynmo_getMutation();
  const [predictions, setPredictions] = useState<ResponseType<"dynmo_get"> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const user = "test user"; // Replace with actual user ID
    // dynmo_getMutation.mutate({ user }, {
    //   onSuccess: (pre) => {
    //     const promises_origing = pre.map((item) => (
    //       getFile(item.image_s3_uri.split('/').splice(3).join('/'), 'weighlty')
    //     ));
    //     Promise.all(promises_origing)
    //       .then((results) => {
    //         const updatedPredictions = pre.map((item, index) => ({
    //           ...item,
    //           download_image_s3_uri: results[index].url,
    //         }));
    //         setPredictions(updatedPredictions);
    //         setLoading(false);
    //       })
    //       .catch((error) => {
    //         console.error("Error fetching images:", error);
    //         setLoading(false);
    //     });

    //     const promises_annotated = pre.map((item) => (
    //       getFile(item.annotated_s3_uri.split('/').splice(3).join('/'), 'weighlty')
    //     ));
    //     Promise.all(promises_annotated)
    //       .then((results) => {
    //         const updatedPredictions = pre.map((item, index) => ({
    //           ...item,
    //           download_annotated_s3_uri: results[index].url,
    //         }));
    //         setPredictions(updatedPredictions);
    //         setLoading(false);
    //       })
    //       .catch((error) => {
    //         console.error("Error fetching images:", error);
    //         setLoading(false);
    //     });
    //     setPredictions(pre);
    //   },
    //   onError: (error) => {
    //     console.error("Error fetching predictions:", error);
    //   }
    // });
    const pre: ResponseType<"dynmo_get"> = [
      {
        "prediction_id": String("123abc"),
        "user": String("user_001"),
        "annotated_s3_uri": String("s3://weighlty/annotated_original_images/test-user_1742852904629_image1.jpg"),
        "created_at": String("2025-03-27T10:15:30Z"),
        "image_s3_uri": String("s3://weighlty/original_images/test-user_1742852904629_image1.jpg"),
        "updated_at": String("2025-03-27T11:00:00Z"),
        "predictions": [] as readonly any[],
      } as const,
      {
        "prediction_id": String("456def"),
        "user": String("user_002"),
        "annotated_s3_uri": String("s3://weighlty/annotated_original_images/test-user_1742852904629_image1.jpg"),
        "created_at": String("2025-03-26T15:45:10Z"),
        "image_s3_uri": String("s3://weighlty/original_images/test-user_1742852904629_image1.jpg"),
        "updated_at": String("2025-03-26T16:30:45Z"),
        "predictions": [] as readonly any[],
      } as const,
      {
        "prediction_id": String("789ghi"),
        "user": String("user_003"),
        "annotated_s3_uri": String("s3://weighlty/annotated_original_images/test-user_1742852904629_image1.jpg"),
        "created_at": String("2025-03-25T08:25:50Z"),
        "image_s3_uri": String("s3://weighlty/original_images/test-user_1742852904629_image1.jpg"),
        "updated_at": String("2025-03-25T09:10:20Z"),
        "predictions": [] as readonly any[],
      } as const,
    ]
    const promises_origing = pre.map((item) => (
      getFile(item.image_s3_uri.split('/').splice(3).join('/'), 'weighlty')
    ));
    Promise.all(promises_origing)
      .then((results) => {
        const updatedPredictions = pre.map((item, index) => ({
          ...item,
          download_image_s3_uri: results[index].url,
        }));
        setPredictions(updatedPredictions);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching images:", error);
        setLoading(false);
      });

    const promises_annotated = pre.map((item) => (
      getFile(item.annotated_s3_uri.split('/').splice(3).join('/'), 'weighlty')
    ));
    Promise.all(promises_annotated)
      .then((results) => {
        const updatedPredictions = pre.map((item, index) => ({
          ...item,
          download_annotated_s3_uri: results[index].url,
        }));
        setPredictions(updatedPredictions);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching images:", error);
        setLoading(false);
      });
    setPredictions(pre);
  }, []);

  const handlePredictionPress = (predictionId: string) => {
    console.log(`Prediction ${predictionId} pressed`)
    // Navigate to details or perform other actions
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Predictions</Text>
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
        <FlatList
          data={predictions}
          keyExtractor={(item) => item.prediction_id}
          renderItem={({ item }) => {
            return <PredictionItem item={item} onPress={() => handlePredictionPress(item.prediction_id)} />
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "white",
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  cameraButton: {
    backgroundColor: "#6200ee",
  },
  listContent: {
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
})
