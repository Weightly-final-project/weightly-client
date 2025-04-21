import type React from "react";
import { useRef, useState, useEffect } from "react";
import {
  CameraView,
  useCameraPermissions,
  type CameraCapturedPicture,
} from "expo-camera";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "react-native-elements";

import { uploadFile, getFile } from "../utils/s3";
import { hooks } from "../utils/api";
import ImagePickerExample from "../components/pickImage";
import Permission from "../components/Permission";
import { Buffer } from "buffer";
import { bigBboxCalculator } from "@/utils/functions";
import CameraHeader from "../components/CameraHeader";
import CameraControls from "../components/CameraControls";
import ImagePreview from "../components/ImagePreview";

// Use your API hooks
const {
  usePredictMutation,
  useOutput_imageMutation,
  useReference_calculatorMutation,
} = hooks;

const responseExample = {
  image_s3_uri: String(),
  annotated_s3_uri: String(),
  predictions: [] as readonly any[],
};

type anototatedImageType = typeof responseExample;

export default function CameraScreen() {
  const router = useRouter();
  const [pictureStatus, setPictureStatus] =
    useState<string>("Ready to capture");
  const [PictureData1, setPictureData1] = useState<
    CameraCapturedPicture | undefined
  >(undefined);
  const [anototatedImage1, setAnnotatedImage1] =
    useState<anototatedImageType>(responseExample);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>(undefined);
  const [downloadOriginUrl, setDownloadOriginUrl] = useState<
    string | undefined
  >(undefined);

  const [permission, requestPermissions] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);

  // Replace your sendFile function with hooks
  const predictMutation = usePredictMutation();
  const outputImageMutation = useOutput_imageMutation();
  const referenceCalculatorMutation = useReference_calculatorMutation();

  // Navigate to prediction screen after saving
  useEffect(() => {
    if (
      downloadUrl &&
      anototatedImage1.image_s3_uri &&
      anototatedImage1.annotated_s3_uri
    ) {
      navigateToPrediction();
    }
  }, [downloadUrl, downloadOriginUrl, anototatedImage1]);

  if (!permission || !permission.granted) {
    return (
      <Permission
        permissionType={"camera"}
        requestPermissions={requestPermissions}
      />
    );
  }

  const navigateToPrediction = () => {
    if (!anototatedImage1.image_s3_uri || !anototatedImage1.annotated_s3_uri)
      return;

    router.replace({
      pathname: "/prediction",
      params: {
        item: Buffer.from(
          JSON.stringify({
            prediction_id: `temp_prediction_${Date.now()}`,
            user: "test user",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            image_s3_uri: anototatedImage1.image_s3_uri,
            annotated_s3_uri: anototatedImage1.annotated_s3_uri,
            download_image_s3_uri: downloadOriginUrl,
            download_annotated_s3_uri: downloadUrl,
          })
        ).toString("base64"),
        predictions: JSON.stringify(anototatedImage1.predictions),
      },
    });
  };

  const sendPicture = async (uri: string) => {
    try {
      setIsProcessing(true);
      setPictureStatus("Uploading image...");

      const res1 = await uploadFile(
        uri,
        `original_images/test-user_${Date.now()}_image1.jpg`
      );

      const formData1 = {
        user: "test user",
        image_s3_uri: `s3://weighlty/${res1.Key}`,
        model_s3_uri: "s3://weighlty/pine.pt",
      } as const;

      const formData2 = {
        user: "test user",
        image_s3_uri: `s3://weighlty/${res1.Key}`,
        model_s3_uri: "s3://rbuixcube/large_files/best.pt",
      } as const;

      setPictureStatus("Processing image...");

      // Use your hooks instead of sendFile
      const prediction = await predictMutation.mutateAsync(formData1);
      const reference_prediction = await predictMutation.mutateAsync(formData2);

      const reference_object = reference_prediction.predictions?.find(
        (obj: any) => obj.object === "rubiks_cube"
      );

      const parsedPredictions = prediction.predictions.filter(
        (prediction) => prediction.confidence >= 0.5
      );
      const bbox = bigBboxCalculator(parsedPredictions);

      console.log("reference_prediction", reference_prediction);
      console.log("prediction", parsedPredictions);
      console.log("reference_object", reference_object);
      console.log("bbox", bbox);

      setPictureStatus("Analyzing objects...");

      if (
        parsedPredictions &&
        bbox &&
        reference_prediction.predictions &&
        reference_prediction.predictions.length > 0
      ) {
        const predictions_with_size =
          await referenceCalculatorMutation.mutateAsync({
            predictions: [
              {
                bbox: Object.values(bbox),
                object: "pine",
                confidence: 0.99,
              },
            ],
            reference_width_cm: 5.8,
            reference_width_px:
              reference_object?.bbox[2] - reference_object?.bbox[0],
            focal_length_px: 10,
            reference_height_px:
              reference_object?.bbox[3] - reference_object?.bbox[1],
          });
        console.log("predictions_with_size", predictions_with_size);
        setPictureStatus("Generating annotated image...");

        const pred1 = await outputImageMutation.mutateAsync({
          user: "test user",
          image_s3_uri: `s3://weighlty/${res1.Key}`,
          predictions: [
            ...predictions_with_size,
            ...(parsedPredictions.map((obj: any) => ({
              ...obj,
              class: obj.object,
            })) as any[]),
          ],
        });

        setPictureStatus("Processing complete!");

        if (pred1.annotated_s3_uri) {
          setAnnotatedImage1({
            image_s3_uri: `s3://weighlty/${res1.Key}`,
            annotated_s3_uri: pred1.annotated_s3_uri,
            predictions: predictions_with_size,
          });

          const origin_image1 = await getFile(res1.Key, "weighlty");
          setDownloadOriginUrl(origin_image1?.url);

          const annotated_image1 = await getFile(
            pred1.annotated_s3_uri.split("/").splice(3).join("/"),
            "weighlty"
          );
          setDownloadUrl(annotated_image1?.url);
          setIsProcessing(false);
          return annotated_image1?.url;
        }
      } else {
        setPictureStatus("No objects detected");
        Alert.alert(
          "No objects detected",
          "Please try again with a clearer image or different angle",
          [{ text: "OK" }]
        );
      }

      setIsProcessing(false);
    } catch (e) {
      console.error(e);
      setPictureStatus("Error processing image");
      Alert.alert(
        "Processing Error",
        "There was an error processing your image. Please try again.",
        [{ text: "OK" }]
      );
      setIsProcessing(false);
      return;
    }
  };

  if (PictureData1) {
    return (
      <ImagePreview
        imageUri={PictureData1.uri}
        isProcessing={isProcessing}
        onRetake={() => setPictureData1(undefined)}
      />
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({
        exif: true,
        quality: 0.8,
        skipProcessing: false,
      });
      processImage(photo);
    }
  };

  const processImage = (photo: CameraCapturedPicture | undefined) => {
    if (!photo) return;

    if (photo?.exif?.Orientation === 6) {
      const temp = photo.width;
      photo.width = photo.height;
      photo.height = temp;
    }
    const { width, height, uri } = photo;

    setPictureData1({ width, height, uri });

    sendPicture(uri).then((annotated_photo) => {
      setPictureData1({ width, height, uri: annotated_photo || uri });
    });
  };
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <CameraHeader onBackPress={() => router.back()} />

      <CameraView style={styles.camera} ref={cameraRef} ratio="16:9">
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraInstructions}>
            <View style={styles.instructionBubble}>
              <Text style={styles.instructionText}>
                Take a picture with pine wood and rubiks cube
              </Text>
            </View>
          </View>

          <View style={styles.cameraGuide}>
            <View style={styles.cameraFrame} />
          </View>

          <CameraControls
            onCapture={takePicture}
            onPickImage={() => {}}
            isProcessing={isProcessing}
          />
        </View>
      </CameraView>
    </View>
  );
}

const { width, height } = Dimensions.get("window");
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
    backgroundColor: "#202020",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(98, 0, 238, 0.8)",
    justifyContent: "center",
    alignItems: "center",
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
  camera: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  cameraHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "space-between",
  },
  cameraInstructions: {
    alignItems: "center",
    marginTop: 100,
  },
  instructionBubble: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 20,
    padding: 12,
    maxWidth: width * 0.8,
  },
  instructionText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
  },
  cameraGuide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraFrame: {
    width: width * 0.8,
    height: width * 0.8,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 12,
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 30,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#121212",
  },
  placeholderButton: {
    width: 50,
    height: 50,
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#202020",
  },
  previewImage: {
    width: width,
    height: height * 0.7,
    resizeMode: "cover",
  },
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "#202020",
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
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#202020",
    height: height * 0.7,
  },
  loadingText: {
    color: "white",
    marginTop: 16,
    textAlign: "center",
  },
  dualImageContainer: {
    flex: 1,
    flexDirection: "column",
    padding: 8,
  },
  imageWrapper: {
    flex: 1,
    margin: 8,
  },
  imageLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  touchableImageContainer: {
    position: "relative",
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  dualImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    resizeMode: "cover",
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
  pointNumber: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  pointInstructions: {
    position: "absolute",
    bottom: 10,
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
});
