import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Card, Chip, Divider } from "react-native-paper";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { hooks } from "../utils/api";
import { Icon } from "react-native-elements";
import { Buffer } from "buffer";
import weight_mapping from "../utils/weight_mapping";
import {
  getFilenameFromS3Uri,
  formatDate,
  totalVolumeCalculator,
  avarageSizeCalculator,
} from "../utils/functions";
import { useAuth } from "../utils/AuthContext";

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
    <View className="flex-1 bg-[#121212]">
      <View className="flex-row items-center justify-between pt-[50px] pb-4 px-4 bg-[#202020]">
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-white/10 justify-center items-center"
          onPress={() => router.back()}
        >
          <Icon name="arrow-back" type="material" color="#fff" size={24} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Prediction Details</Text>
        <View />
      </View>

      <Text className="text-center text-[#999] text-xs py-1 bg-[#202020]">
        Pull down to refresh
      </Text>
      <ScrollView
        className="flex-1"
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
        <View className="relative w-full h-[40%]">
          <Image
            source={{ uri: imageUrl }}
            className="w-full h-full object-cover"
          />
          <View className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 items-center">
            <Text className="text-white text-sm">
              total volume(m3): {(totalVolume / 1000000).toFixed(3)}
            </Text>
            <Text className="text-white text-sm">
              weight (kg): {(totalVolume * weight_mapping.pine) / 1000}
            </Text>
            <Text className="text-white text-sm">
              size (cm):{" "}
              {Object.values(avarageSize)
                .map((item) => item.toFixed(3))
                .join("X")}
            </Text>
            <Text className="text-white text-sm">wood count: {woodCount}</Text>
          </View>
          <View className="absolute top-4 right-4">
            <Chip
              icon="image"
              className="bg-black/70"
              textStyle={{ fontSize: 12, color: "white" }}
            >
              {typeof image_s3_uri === "string"
                ? getFilenameFromS3Uri(image_s3_uri)
                : "Image"}
            </Chip>
          </View>
        </View>

        <View className="p-4">
          <View className="mb-6">
            <Text className="text-lg font-bold text-white mb-4">
              Prediction Information
            </Text>

            <View className="flex-row items-center mb-3">
              <Text className="w-20 text-sm text-[#999]">ID:</Text>
              <Text className="flex-1 text-sm text-white">{prediction_id}</Text>
            </View>

            <View className="flex-row items-center mb-3">
              <Text className="w-20 text-sm text-[#999]">User:</Text>
              <Chip
                icon="account"
                className="bg-[#6200ee]"
                textStyle={{ color: "white" }}
              >
                {userId}
              </Chip>
            </View>

            <View className="flex-row items-center mb-3">
              <Text className="w-20 text-sm text-[#999]">Created:</Text>
              <Text className="flex-1 text-sm text-white">
                {typeof created_at === "string"
                  ? formatDate(created_at)
                  : "Unknown"}
              </Text>
            </View>

            <View className="flex-row items-center mb-3">
              <Text className="w-20 text-sm text-[#999]">Updated:</Text>
              <Text className="flex-1 text-sm text-white">
                {typeof updated_at === "string"
                  ? formatDate(updated_at)
                  : "Unknown"}
              </Text>
            </View>
          </View>

          <Divider className="bg-[#333] h-px my-4" />

          <View className="mb-6">
            <Text className="text-lg font-bold text-white mb-4">
              Storage Information
            </Text>

            <Card className="bg-[#2A2A2A] mb-3 rounded-lg overflow-hidden">
              <Card.Content>
                <Text className="text-sm text-[#999] mb-1">Image S3 URI:</Text>
                <Text
                  className="text-xs text-white font-mono"
                  selectable
                >
                  {image_s3_uri}
                </Text>
              </Card.Content>
            </Card>

            <Card className="bg-[#2A2A2A] mb-3 rounded-lg overflow-hidden">
              <Card.Content>
                <Text className="text-sm text-[#999] mb-1">
                  Annotated S3 URI:
                </Text>
                <Text
                  className="text-xs text-white font-mono"
                  selectable
                >
                  {annotated_s3_uri}
                </Text>
              </Card.Content>
            </Card>
          </View>
          <Divider className="bg-[#333] h-px my-4" />

          <View className="bg-[#202020] p-2 items-center">
            <Text className="text-[#6200ee] text-sm">{pictureStatus}</Text>
          </View>

          {(prediction_id as string).split("_")[0] === "temp" && (
            <TouchableOpacity
              className={`flex-row items-center justify-center bg-[#6200ee] py-3 px-5 rounded-lg min-w-[100px] ${
                isProcessing ? "opacity-50" : ""
              }`}
              disabled={isProcessing}
              onPress={saveResults}
            >
              <Icon name="save" type="material" color="white" size={24} />
              <Text className="text-white font-bold ml-2">Save</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}