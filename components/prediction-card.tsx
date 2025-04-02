import { View, Text, StyleSheet, Dimensions } from "react-native"
import { Card, Chip, Button } from "react-native-paper"
import { Link } from "expo-router"
import { format } from "date-fns"
import { Buffer } from 'buffer'

// Helper function to extract filename from S3 URI
const getFilenameFromS3Uri = (uri: string) => {
  const parts = uri.split("/")
  return parts[parts.length - 1]
}

// Helper function to format date
const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), "MMM d, yyyy • h:mm a")
  } catch (e) {
    return dateString
  }
}

type PredictionItemProps = {
  item: {
    prediction_id: string
    user: string
    annotated_s3_uri: string
    created_at: string
    image_s3_uri: string
    updated_at: string
    download_image_s3_uri: string
    download_annotated_s3_uri: string
    predictions: readonly any[]
  }
  onPress?: () => void
}

const PredictionItem = ({ item, onPress }: PredictionItemProps) => {
  // For demo purposes, we'll use a placeholder image
  // In production, you would use a proper image loading mechanism for S3
  const imageUrl = item.download_annotated_s3_uri

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Cover source={{ uri: imageUrl }} style={styles.cardImage} />

      <View style={styles.overlay}>
        <Chip icon="image" style={styles.fileChip} textStyle={styles.chipText}>
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
          <Chip icon="account" style={styles.userChip} textStyle={styles.chipText}>
            {item.user}
          </Chip>
        </View>

        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>Created:</Text>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.footer}>
          <Link href={{
            pathname: "/prediction",
            params: {
              item: Buffer.from(JSON.stringify(item)).toString("base64"),
              predictions: JSON.stringify(item.predictions),
            },
          }} asChild>
            <Button mode="contained" onPress={onPress} style={styles.viewButton} icon="eye">
              View Details
            </Button>
          </Link>
        </View>
      </Card.Content>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    backgroundColor: "#202020",
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
  },
  viewButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: "#6200ee",
  },
  editButton: {
    flex: 1,
    marginLeft: 8,
    borderColor: "#6200ee",
  },
})

export default PredictionItem

