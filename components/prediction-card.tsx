import { View, Text, Alert } from "react-native";
import { Card, Chip, Button } from "react-native-paper";
import { Link } from "expo-router";
import { Buffer } from "buffer";
import { getFilenameFromS3Uri, formatDate } from "../utils/functions";
import { hooks } from "../utils/api";
import { useAuth } from "../utils/AuthContext";

const { useDynmo_deleteMutation } = hooks;

type PredictionItemProps = {
  item: {
    prediction_id: string;
    user: string;
    annotated_s3_uri: string;
    created_at: string;
    image_s3_uri: string;
    updated_at: string;
    download_image_s3_uri: string;
    download_annotated_s3_uri: string;
    predictions: readonly any[];
  };
  onPress?: () => void;
  onDelete?: () => void;
};

const PredictionItem = ({ item, onPress, onDelete }: PredictionItemProps) => {
  const { user } = useAuth();
  const userId = user?.username || "guest";
  const deleteMutation = useDynmo_deleteMutation();
  const imageUrl = item.download_annotated_s3_uri;

  const handleDelete = async () => {
    Alert.alert(
      "Delete Prediction",
      "Are you sure you want to delete this prediction?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({
                user: userId,
                prediction_id: item.prediction_id,
              });
              if (onDelete) {
                onDelete();
              }
            } catch (error) {
              console.error("Error deleting prediction:", error);
              Alert.alert(
                "Error",
                "Failed to delete prediction. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <Card className="my-2 mx-4 rounded-xl bg-[#202020]" mode="elevated">
      <View className="overflow-hidden rounded-xl">
        <Card.Cover source={{ uri: imageUrl }} className="h-[180px] rounded-t-xl" />

        <View className="absolute top-3 right-3">
          <Chip
            icon="image"
            className="bg-black/70"
            textStyle={{ fontSize: 12, color: 'white' }}
          >
            {getFilenameFromS3Uri(item.annotated_s3_uri)}
          </Chip>
        </View>

        <Card.Content className="py-4">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center">
              <Text className="text-sm font-bold text-[#AAA] mr-1">ID:</Text>
              <Text className="text-sm text-[#DDD] font-mono">{item.prediction_id}</Text>
            </View>
          </View>

          <View className="flex-row items-center mb-4">
            <Text className="text-sm font-bold text-[#AAA] mr-1">User:</Text>
            <Chip
              icon="account"
              className="bg-[#6200ee]"
              textStyle={{ fontSize: 12, color: 'white' }}
            >
              {item.user}
            </Chip>
          </View>

          <View className="flex-row items-center mb-4">
            <Text className="text-sm font-bold text-[#AAA] mr-1">Created:</Text>
            <Text className="text-sm text-[#DDD]">{formatDate(item.created_at)}</Text>
          </View>

          <View className="flex-row justify-between mt-2 gap-2">
            <Link
              href={{
                pathname: "/prediction",
                params: {
                  item: Buffer.from(JSON.stringify(item)).toString("base64"),
                  predictions: JSON.stringify(item.predictions),
                },
              }}
              asChild
              className="flex-1"
            >
              <Button
                mode="contained"
                onPress={onPress}
                className="bg-[#6200ee]"
                icon="eye"
              >
                View Details
              </Button>
            </Link>
            <Button
              mode="contained"
              onPress={handleDelete}
              className="bg-[#dc3545]"
              icon="delete"
            >
              Delete
            </Button>
          </View>
        </Card.Content>
      </View>
    </Card>
  );
};

export default PredictionItem;
