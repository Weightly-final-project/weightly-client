import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from "react-native"
import { useLocalSearchParams, useRouter, Stack } from "expo-router"
import { Card, Chip, Divider } from "react-native-paper"
import { Image } from "expo-image"
import { format } from "date-fns"
import { ArrowLeft, Share2 } from "lucide-react-native"

// Helper function to extract filename from S3 URI
const getFilenameFromS3Uri = (uri: string) => {
  const parts = uri.split("/")
  return parts[parts.length - 1]
}

// Helper function to format date
const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), "MMMM d, yyyy 'at' h:mm a")
  } catch (e) {
    return dateString
  }
}

export default function PredictionScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { prediction_id, user, created_at, updated_at, image_s3_uri, annotated_s3_uri, download_image_s3_uri, download_annotated_s3_uri } = params

  // For demo purposes, we'll use a placeholder image
  // In production, you would use a proper image loading mechanism for S3
  const imageUrl = encodeURI(download_annotated_s3_uri as string);  
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prediction Details</Text>
        <View></View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
          <View style={styles.imageOverlay}>
            <Chip icon="image" style={styles.fileChip} textStyle={styles.chipText}>
              {typeof image_s3_uri === "string" ? getFilenameFromS3Uri(image_s3_uri) : "Image"}
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
              <Chip icon="account" style={styles.userChip} textStyle={styles.userChipText}>
                {user}
              </Chip>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created:</Text>
              <Text style={styles.infoValue}>
                {typeof created_at === "string" ? formatDate(created_at) : "Unknown"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Updated:</Text>
              <Text style={styles.infoValue}>
                {typeof updated_at === "string" ? formatDate(updated_at) : "Unknown"}
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Storage Information</Text>

            <Card style={styles.storageCard}>
              <Card.Content>
                <Text style={styles.storageLabel}>Image S3 URI:</Text>
                <Text style={styles.storageValue} selectable>
                  {image_s3_uri}
                </Text>
              </Card.Content>
            </Card>

            <Card style={styles.storageCard}>
              <Card.Content>
                <Text style={styles.storageLabel}>Annotated S3 URI:</Text>
                <Text style={styles.storageValue} selectable>
                  {annotated_s3_uri}
                </Text>
              </Card.Content>
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const { width, height } = Dimensions.get("window")

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: "#1E1E1E",
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
})