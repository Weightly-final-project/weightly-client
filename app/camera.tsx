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
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "react-native-elements";

import { getFile, uploadFile } from "../utils/s3";
import { hooks } from "../utils/api";
import Permission from "../components/Permission";
import { Buffer } from "buffer";
import { bigBboxCalculator } from "../utils/functions";
import CameraControls from "../components/CameraControls";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../utils/AuthContext";
import { ManualBoundingBox } from "../components/ManualBoundingBox";
import { OrientationGuide } from "../components/OrientationGuide";

// Use your API hooks
const {
  usePredictMutation,
  useOutput_imageMutation,
  useReference_calculatorMutation,
} = hooks;

type PhotoMode = 'top-down' | 'horizontal';

interface CapturedPhoto {
  photo: CameraCapturedPicture;
  processed?: boolean;
  annotatedImage?: {
    image_s3_uri: string;
    annotated_s3_uri: string;
    download_annotated_s3_uri?: string;
    predictions: any[];
  };
}

interface PhotoToProcess {
  photo: CameraCapturedPicture | undefined;
  processed?: boolean;
  annotatedImage?: {
    image_s3_uri: string;
    annotated_s3_uri: string;
    predictions: any[];
  };
}

export default function CameraScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.username || "guest";

  const [pictureStatus, setPictureStatus] = useState<string>("Ready to capture");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showManualBoundingBox, setShowManualBoundingBox] = useState(false);
  const [isOrientationValid, setIsOrientationValid] = useState(false);
  const [mode, setMode] = useState<PhotoMode>('top-down');
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);

  const [permission, requestPermissions] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const predictMutation = usePredictMutation();
  const outputImageMutation = useOutput_imageMutation();
  const referenceCalculatorMutation = useReference_calculatorMutation();

  const requiredPhotos = 2;

  const getPhotoInstructions = () => {
    if (mode === 'top-down') {
      return "Take a top-down photo of the object";
    }
    return `Take horizontal photo of the object.`;
  };

  useEffect(() => {
    // Only reset photos if we're starting fresh
    if (capturedPhotos.length === 0) {
      setCurrentPhotoIndex(0);
    }
  }, [mode]);

  const handleModeChange = (newMode: PhotoMode) => {
    if (mode !== newMode) {
      setMode(newMode);
      // Only reset if we haven't taken any photos yet
      if (capturedPhotos.length === 0) {
        setCurrentPhotoIndex(0);
      }
    }
  };

  if (!permission || !permission.granted) {
    return (
      <View style={styles.container}>
        <AppHeader title="Camera" showBack={true} />
        <Permission
          permissionType={"camera"}
          requestPermissions={requestPermissions}
        />
      </View>
    );
  }

  const navigateToPrediction = (processedPhotos: CapturedPhoto[]) => {
    const lastPhoto = processedPhotos[processedPhotos.length - 1];
    if (!lastPhoto?.annotatedImage?.image_s3_uri || !lastPhoto?.annotatedImage?.annotated_s3_uri) return;

    router.replace({
      pathname: "/confirm-photos",
      params: {
        photos: Buffer.from(JSON.stringify(processedPhotos)).toString("base64"),
        predictions: JSON.stringify(lastPhoto.annotatedImage.predictions),
      },
    });
  };

  const handleManualBoundingBox = async (bbox: { minX: number, minY: number, maxX: number, maxY: number }) => {
    try {
      setIsProcessing(true);
      setPictureStatus("Processing manual selection...");

      const currentPhoto = capturedPhotos[currentPhotoIndex];
      if (!currentPhoto) return;

      const res1 = await uploadFile(
        currentPhoto.photo.uri,
        `original_images/${userId}_${Date.now()}_image${currentPhotoIndex + 1}.jpg`
      );

      const predictions_with_size = [
        {
          bbox: [bbox.minX * 1000, bbox.minY * 1000, bbox.maxX * 1000, bbox.maxY * 1000],
          object: "pine",
          confidence: 0.99,
          size_cm: [30, 30, 30],
        }
      ];

      setPictureStatus("Generating annotated image...");

      const pred1 = await outputImageMutation.mutateAsync({
        user: userId,
        image_s3_uri: `s3://weighlty/${res1.Key}`,
        predictions: predictions_with_size,
      });

      if (pred1.annotated_s3_uri) {
        const updatedPhotos = [...capturedPhotos];
        const download_annotated_s3 = await getFile(
          pred1.annotated_s3_uri.split('/').splice(3).join('/')
        );
        updatedPhotos[currentPhotoIndex] = {
          ...currentPhoto,
          processed: true,
          annotatedImage: {
            image_s3_uri: `s3://weighlty/${res1.Key}`,
            annotated_s3_uri: pred1.annotated_s3_uri,
            download_annotated_s3_uri: download_annotated_s3?.url,
            predictions: predictions_with_size,
          },
        };
        setCapturedPhotos(updatedPhotos);

        if (currentPhotoIndex + 1 < requiredPhotos) {
          setCurrentPhotoIndex(currentPhotoIndex + 1);
          setIsProcessing(false);
        } else {
          setPictureStatus("Preparing results...");
          // Navigate to confirmation page immediately
          navigateToPrediction(updatedPhotos);
        }

        setShowManualBoundingBox(false);
      } else {
        throw new Error("Failed to generate annotated image");
      }
    } catch (error) {
      console.error(error);
      setPictureStatus("Error processing manual selection");
      Alert.alert(
        "Processing Error",
        "There was an error processing your manual selection. Please try again.",
        [{ text: "OK" }]
      );
      setIsProcessing(false);
    }
  };

  const processPhoto = async (photo: PhotoToProcess) => {
    if (!photo.photo) return false;
    try {
      setIsProcessing(true);
      setPictureStatus("Uploading image...");

      const res1 = await uploadFile(
        photo.photo.uri,
        `original_images/${userId}_${Date.now()}_image${currentPhotoIndex + 1}.jpg`
      );

      const formData1 = {
        user: userId,
        image_s3_uri: `s3://weighlty/${res1.Key}`,
        model_s3_uri: "s3://weighlty/pine.pt",
      } as const;

      const formData2 = {
        user: userId,
        image_s3_uri: `s3://weighlty/${res1.Key}`,
        model_s3_uri: "s3://rbuixcube/large_files/best.pt",
      } as const;

      setPictureStatus("Processing image...");

      const prediction = await predictMutation.mutateAsync(formData1);
      const reference_prediction = await predictMutation.mutateAsync(formData2);

      const reference_object = reference_prediction.predictions?.find(
        (obj: any) => obj.object === "rubiks_cube"
      );

      const parsedPredictions = prediction.predictions.filter(
        (prediction) => prediction.confidence >= 0.5
      );
      const bbox = bigBboxCalculator(parsedPredictions);

      setPictureStatus("Analyzing objects...");

      // Log detection information for debugging
      console.log('Detection status:', {
        photoIndex: currentPhotoIndex,
        foundPredictions: parsedPredictions && parsedPredictions.length > 0,
        foundBbox: !!bbox,
        hasReferenceObject: !!reference_object,
        referenceObjectBbox: reference_object?.bbox,
      });

      if (
        parsedPredictions &&
        bbox &&
        reference_prediction.predictions &&
        reference_prediction.predictions.length > 0 &&
        reference_object &&
        Array.isArray(reference_object.bbox) &&
        reference_object.bbox.length === 4 &&
        reference_object.bbox.every((v: any) => typeof v === 'number')
      ) {
        try {
          const predictions_with_size = await referenceCalculatorMutation.mutateAsync({
            predictions: [
              {
                bbox: Object.values(bbox),
                object: "pine",
                confidence: 0.99,
              },
            ],
            reference_width_cm: 5.8,
            reference_width_px: reference_object.bbox[2] - reference_object.bbox[0],
            focal_length_px: 10,
            reference_height_px: reference_object.bbox[3] - reference_object.bbox[1],
          });

          setPictureStatus("Generating annotated image...");

          // Convert predictions_with_size to a mutable array of objects and force type any[]
          const mutablePredictionsWithSize = Array.from(predictions_with_size, x => ({ ...x }));

          const pred1 = await outputImageMutation.mutateAsync({
            user: userId,
            image_s3_uri: `s3://weighlty/${res1.Key}`,
            predictions: [
              ...mutablePredictionsWithSize,
              ...(parsedPredictions.map((obj: any) => ({
                ...obj,
                class: obj.object,
              })) as any[]),
            ],
          });

          if (pred1.annotated_s3_uri) {
            const updatedPhotos = [...capturedPhotos];
            const download_annotated_s3 = await getFile(
              pred1.annotated_s3_uri.split('/').splice(3).join('/')
            );
            updatedPhotos[currentPhotoIndex] = {
              photo: photo.photo,
              processed: true,
              annotatedImage: {
                image_s3_uri: `s3://weighlty/${res1.Key}`,
                annotated_s3_uri: pred1.annotated_s3_uri,
                download_annotated_s3_uri: download_annotated_s3?.url,
                predictions: [
                  ...Array.from(predictions_with_size, x => ({ ...x })),
                  ...parsedPredictions
                ]
              },
            };
            setCapturedPhotos(updatedPhotos);

            if (currentPhotoIndex + 1 < requiredPhotos) {
              setCurrentPhotoIndex(currentPhotoIndex + 1);
            } else {
              navigateToPrediction(updatedPhotos);
            }
            setIsProcessing(false);
            return true;
          }
        } catch (error) {
          console.error('Error in reference calculator:', error);
          // Fall through to manual selection if calculation fails
        }
      }

      // Always offer manual selection if we get here (no object detection or reference calculation failed)
      setPictureStatus("No objects detected");
      Alert.alert(
        "No objects detected",
        "Would you like to manually select the object area?",
        [
          {
            text: "Yes",
            onPress: () => {
              setShowManualBoundingBox(true);
              setIsProcessing(false);
            },
          },
          {
            text: "No",
            onPress: () => {
              Alert.alert(
                "No objects detected",
                "Please try again with a clearer image or different angle",
                [{ text: "OK" }]
              );
              setIsProcessing(false);
            },
          },
        ]
      );

      setIsProcessing(false);
      return false;
    } catch (e) {
      console.error(e);
      setPictureStatus("Error processing image");
      Alert.alert(
        "Processing Error",
        "There was an error processing your image. Please try again.",
        [{ text: "OK" }]
      );
      setIsProcessing(false);
      return false;
    }
  };

  const takePicture = async () => {
    if (!isOrientationValid) {
      Alert.alert(
        "Incorrect Angle",
        "Please hold your phone at the correct angle before taking the picture.",
        [{ text: "OK" }]
      );
      return;
    }

    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({
        exif: true,
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo) {
        Alert.alert(
          "Could not take picture",
          "Try again if problem persists contact support",
          [{ text: "OK" }]
        );
        return;
      }

      if (photo?.exif?.Orientation === 6) {
        const temp = photo.width;
        photo.width = photo.height;
        photo.height = temp;
      }

      const newPhoto: CapturedPhoto = {
        photo: photo,
        processed: false,
      };

      // Create a new array with the photo at the current index
      const updatedPhotos = [...capturedPhotos];
      updatedPhotos[currentPhotoIndex] = newPhoto;
      setCapturedPhotos(updatedPhotos);

      // Process the photo
      await processPhoto(newPhoto);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <AppHeader title="Camera" showBack={true} />

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
        />
        <View style={styles.cameraOverlay}>
          <OrientationGuide
            onOrientationValid={setIsOrientationValid}
            mode={mode}
          />
          <View style={styles.buttonContainer}>
            <View style={styles.buttonContainerInner}>
              <TouchableOpacity
                style={[styles.modeButton, mode === 'top-down' && styles.activeModeButton]}
                onPress={() => handleModeChange('top-down')}
              >
                <Icon name="arrow-down" type="material-community" color={mode === 'top-down' ? '#4CAF50' : '#FFF'} />
                <Text style={[styles.modeButtonText, mode === 'top-down' && styles.activeModeButtonText]}>Top-Down</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, mode === 'horizontal' && styles.activeModeButton]}
                onPress={() => handleModeChange('horizontal')}
              >
                <Icon name="camera" type="material-community" color={mode === 'horizontal' ? '#4CAF50' : '#FFF'} />
                <Text style={[styles.modeButtonText, mode === 'horizontal' && styles.activeModeButtonText]}>Horizontal</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View>
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>{getPhotoInstructions()}</Text>
              <Text style={styles.photoCountText}>
                Photo {currentPhotoIndex + 1} of {requiredPhotos}
              </Text>
            </View>
            <CameraControls
              onCapture={takePicture}
              onPickImage={(photo: CameraCapturedPicture | undefined) => {
                if (!photo) return;
                const newPhoto: CapturedPhoto = {
                  photo: photo,
                  processed: false,
                };
                const updatedPhotos = [...capturedPhotos];
                updatedPhotos[currentPhotoIndex] = newPhoto;
                setCapturedPhotos(updatedPhotos);
                processPhoto(newPhoto);
              }}
              isProcessing={isProcessing}
            />
          </View>
        </View>

        {/* Show previews in an overlay that doesn't block the camera */}
        {capturedPhotos.length > 0 && (
          <View style={styles.previewOverlayContainer}>
            <ScrollView horizontal style={styles.previewScroll}>
              {capturedPhotos.map((photo, index) => (
                <View key={index} style={styles.previewThumbContainer}>
                  <Image source={{ uri: photo.photo.uri }} style={styles.previewThumb} />
                  <View style={styles.previewThumbOverlay}>
                    <Text style={styles.previewThumbText}>{index + 1}</Text>
                    {!photo.processed && (
                      <TouchableOpacity
                        style={styles.retakeButton}
                        onPress={() => {
                          const newPhotos = [...capturedPhotos];
                          newPhotos.splice(index);
                          setCapturedPhotos(newPhotos);
                          setCurrentPhotoIndex(index);
                        }}
                      >
                        <Text style={styles.retakeButtonText}>Retake</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {isProcessing && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.processingText}>{pictureStatus}</Text>
          </View>
        )}

        {showManualBoundingBox && capturedPhotos[currentPhotoIndex] && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <ManualBoundingBox
              imageUri={capturedPhotos[currentPhotoIndex].photo.uri}
              onBoundingBoxSelected={handleManualBoundingBox}
              onCancel={() => {
                setShowManualBoundingBox(false);
                setIsProcessing(false);
              }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const { width, height } = Dimensions.get("window");
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
    width: "100%",
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
    flexDirection: "column",
    position: "absolute",
    width: "100%",
    height: "100%",
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
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#121212",
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
  previewContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  processingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  processingText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
  },
  cameraContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  controlsContainer: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
  },
  instructionsContainer: {
    alignItems: 'center',
  },
  instructionsText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 8,
  },
  photoCountText: {
    color: 'white',
    fontSize: 16,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 10,
    right: 0,
  },
  buttonContainerInner: {
    gap: 8,
  },
  modeButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  activeModeButton: {
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  modeButtonText: {
    color: '#FFF',
    marginTop: 4,
    fontSize: 12,
  },
  activeModeButtonText: {
    color: '#4CAF50',
  },
  previewScroll: {
    flex: 1,
  },
  previewImageContainer: {
    width: width,
    height: height * 0.7,
    position: 'relative',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retakeButton: {
    backgroundColor: '#6200ee',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retakeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  previewOverlayContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'transparent',
  },
  previewThumbContainer: {
    width: 80,
    height: 80,
    marginLeft: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  previewThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewThumbOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    alignItems: 'center',
  },
  previewThumbText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
