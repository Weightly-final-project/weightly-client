import { View, Text, StyleSheet, Dimensions, Alert } from "react-native";
import { Card, Chip, Button } from "react-native-paper";
import { Link } from "expo-router";
import { Buffer } from "buffer";
import { getFilenameFromS3Uri, formatDate } from "@/utils/functions";
import { hooks } from "@/utils/api";
import { useAuth } from "@/utils/AuthContext";

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
    <Card style={styles.card} mode="elevated">
      <View style={styles.cardContentWrapper}>
        <Card.Cover source={{ uri: imageUrl }} style={styles.cardImage} />

        <View style={styles.overlay}>
          <Chip
            icon="image"
            style={styles.fileChip}
            textStyle={styles.chipText}
          >
            {getFilenameFromS3Uri(item.annotated_s3_uri)}
          </Chip>
        </View>

        <Card.Content style={styles.content}>
          <View style={styles.header}>
            <View style={styles.idContainer}>
              <Text style={styles.idLabel}>ID:</Text>
              <Text style={styles.id}>{item.prediction_id}</Text>
            </View>
          </View>

          <View style={styles.dateContainer}>
            <Text style={styles.idLabel}>User:</Text>
            <Chip
              icon="account"
              style={styles.userChip}
              textStyle={styles.chipText}
            >
              {item.user}
            </Chip>
          </View>

          <View style={styles.dateContainer}>
            <Text style={styles.dateLabel}>Created:</Text>
            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={styles.footer}>
            <Link
              href={{
                pathname: "/prediction",
                params: {
                  item: Buffer.from(JSON.stringify(item)).toString("base64"),
                  predictions: JSON.stringify(item.predictions),
                },
              }}
              asChild
            >
              <Button
                mode="contained"
                onPress={onPress}
                style={styles.viewButton}
                icon="eye"
              >
                View Details
              </Button>
            </Link>
            <Button
              mode="contained"
              onPress={handleDelete}
              style={styles.deleteButton}
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

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 4,
    backgroundColor: "#202020",
  },
  cardContentWrapper: {
    overflow: "hidden",
    borderRadius: 12,
  },
  cardImage: {
    height: 180,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  overlay: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  fileChip: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  chipText: {
    fontSize: 12,
    color: "white",
  },
  content: {
    paddingVertical: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  idContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  idLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#AAA",
    marginRight: 4,
  },
  id: {
    fontSize: 14,
    color: "#DDD",
    fontFamily: "monospace",
  },
  userChip: {
    backgroundColor: "#6200ee",
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#AAA",
    marginRight: 4,
  },
  date: {
    fontSize: 14,
    color: "#DDD",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 8,
  },
  viewButton: {
    flex: 1,
    backgroundColor: "#6200ee",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#dc3545",
  },
});

export default PredictionItem;
