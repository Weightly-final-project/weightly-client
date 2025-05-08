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
  ActivityIndicator,
  Alert,
  StatusBar,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "react-native-elements";

import { uploadFile } from "../utils/s3";
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

const responseExample = {
  image_s3_uri: String(),
  annotated_s3_uri: String(),
  predictions: [] as readonly any[],
};

type anototatedImageType = typeof responseExample;

type PhotoMode = 'top-down' | 'horizontal';

interface CapturedPhoto {
  photo: CameraCapturedPicture;
  processed?: boolean;
  annotatedImage?: anototatedImageType;
}

interface PhotoToProcess {
  photo: CameraCapturedPicture | undefined;
  processed?: boolean;
  annotatedImage?: anototatedImageType;
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
    // Reset photos when mode changes
    setCapturedPhotos([]);
    setCurrentPhotoIndex(0);
  }, [mode]);

  if (!permission || !permission.granted) {
    return (
      <View className="flex-1 bg-black">
        <AppHeader title="Camera" showBack={true} />
        <Permission permissionType={"camera"} requestPermissions={requestPermissions} />
      </View>
    );
  }

  const navigateToPrediction = (processedPhotos: CapturedPhoto[]) => {
    const lastPhoto = processedPhotos[processedPhotos.length - 1];
    if (!lastPhoto?.annotatedImage?.image_s3_uri || !lastPhoto?.annotatedImage?.annotated_s3_uri) return;

    router.replace({
      pathname: "/prediction",
      params: {
        item: Buffer.from(
          JSON.stringify({
            prediction_id: `temp_prediction_${Date.now()}`,
            user: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            image_s3_uri: lastPhoto.annotatedImage.image_s3_uri,
            annotated_s3_uri: lastPhoto.annotatedImage.annotated_s3_uri,
            photos: processedPhotos.map(p => ({
              image_s3_uri: p.annotatedImage?.image_s3_uri,
              annotated_s3_uri: p.annotatedImage?.annotated_s3_uri,
            })),
          })
        ).toString("base64"),
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
        updatedPhotos[currentPhotoIndex] = {
          ...currentPhoto,
          processed: true,
          annotatedImage: {
            image_s3_uri: `s3://weighlty/${res1.Key}`,
            annotated_s3_uri: pred1.annotated_s3_uri,
            predictions: predictions_with_size,
          },
        };
        setCapturedPhotos(updatedPhotos);

        if (currentPhotoIndex + 1 < requiredPhotos) {
          setCurrentPhotoIndex(currentPhotoIndex + 1);
        } else {
          navigateToPrediction(updatedPhotos);
        }
      }

      setShowManualBoundingBox(false);
      setIsProcessing(false);
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

      if (
        parsedPredictions &&
        bbox &&
        reference_prediction.predictions &&
        reference_prediction.predictions.length > 0
      ) {
        const predictions_with_size = await referenceCalculatorMutation.mutateAsync({
          predictions: [
            {
              bbox: Object.values(bbox),
              object: "pine",
              confidence: 0.99,
            },
          ],
          reference_width_cm: 5.8,
          reference_width_px: reference_object?.bbox[2] - reference_object?.bbox[0],
          focal_length_px: 10,
          reference_height_px: reference_object?.bbox[3] - reference_object?.bbox[1],
        });

        setPictureStatus("Generating annotated image...");

        const pred1 = await outputImageMutation.mutateAsync({
          user: userId,
          image_s3_uri: `s3://weighlty/${res1.Key}`,
          predictions: [
            ...predictions_with_size,
            ...(parsedPredictions.map((obj: any) => ({
              ...obj,
              class: obj.object,
            })) as any[]),
          ],
        });

        if (pred1.annotated_s3_uri) {
          const updatedPhotos = [...capturedPhotos];
          updatedPhotos[currentPhotoIndex] = {
            photo: photo.photo,
            processed: true,
            annotatedImage: {
              image_s3_uri: `s3://weighlty/${res1.Key}`,
              annotated_s3_uri: pred1.annotated_s3_uri,
              predictions: predictions_with_size,
            },
          };
          setCapturedPhotos(updatedPhotos);

          if (currentPhotoIndex + 1 < requiredPhotos) {
            setCurrentPhotoIndex(currentPhotoIndex + 1);
          } else {
            navigateToPrediction(updatedPhotos);
          }
          return true;
        }
      } else {
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
      }

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

      const updatedPhotos = [...capturedPhotos];
      updatedPhotos[currentPhotoIndex] = newPhoto;
      setCapturedPhotos(updatedPhotos);

      await processPhoto(newPhoto);
    }
  };

  const renderPhotoPreview = () => {
    if (showManualBoundingBox && capturedPhotos[currentPhotoIndex]) {
      return (
        <View className="flex-1 bg-black">
          <AppHeader title="Manual Selection" showBack={true} />
          <ManualBoundingBox
            imageUri={capturedPhotos[currentPhotoIndex].photo.uri}
            onBoundingBoxSelected={handleManualBoundingBox}
          />
          {isProcessing && (
            <View className="absolute inset-0 justify-center items-center bg-black/50">
              <ActivityIndicator size="large" color="#FFF" />
              <Text className="text-white text-lg font-bold mt-4">{pictureStatus}</Text>
            </View>
          )}
        </View>
      );
    }

    if (capturedPhotos.length > 0) {
      return (
        <View className="flex-1 justify-center items-center">
          <ScrollView horizontal pagingEnabled className="flex-1">
            {capturedPhotos.map((photo, index) => (
              <View key={index} className="w-full h-[70%] relative">
                <Image source={{ uri: photo.photo.uri }} className="w-full h-full" />
                <View className="absolute bottom-0 left-0 right-0 bg-black/50 p-4 flex-row justify-between items-center">
                  <Text className="text-white text-base font-bold">Photo {index + 1}</Text>
                  {!photo.processed && (
                    <TouchableOpacity
                      className="bg-[#6200ee] px-4 py-2 rounded-lg"
                      onPress={() => {
                        const newPhotos = [...capturedPhotos];
                        newPhotos.splice(index);
                        setCapturedPhotos(newPhotos);
                        setCurrentPhotoIndex(index);
                      }}
                    >
                      <Text className="text-white text-sm font-bold">Retake</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
          {isProcessing && (
            <View className="absolute inset-0 justify-center items-center bg-black/50">
              <ActivityIndicator size="large" color="#FFF" />
              <Text className="text-white text-lg font-bold mt-4">{pictureStatus}</Text>
            </View>
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <AppHeader title="Camera" showBack={true} />

      <View className="flex-1 justify-center items-center">
        {capturedPhotos.length < requiredPhotos && (
          <>
            <CameraView ref={cameraRef} className="flex-1 w-full" />
            <View className="flex-1 bg-transparent justify-between flex-col absolute w-full h-full">
              <OrientationGuide onOrientationValid={setIsOrientationValid} mode={mode} />
              <View className="absolute bottom-10 right-0">
                <View className="gap-2">
                  <TouchableOpacity
                    className={`bg-black/50 p-3 rounded-lg items-center mx-2 ${mode === 'top-down' ? 'bg-black/80' : ''}`}
                    onPress={() => setMode('top-down')}
                  >
                    <Icon 
                      name="arrow-down" 
                      type="material-community" 
                      color={mode === 'top-down' ? '#4CAF50' : '#FFF'} 
                    />
                    <Text className={`text-white text-xs mt-1 ${mode === 'top-down' ? 'text-[#4CAF50]' : ''}`}>
                      Top-Down
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`bg-black/50 p-3 rounded-lg items-center mx-2 ${mode === 'horizontal' ? 'bg-black/80' : ''}`}
                    onPress={() => setMode('horizontal')}
                  >
                    <Icon 
                      name="camera" 
                      type="material-community" 
                      color={mode === 'horizontal' ? '#4CAF50' : '#FFF'} 
                    />
                    <Text className={`text-white text-xs mt-1 ${mode === 'horizontal' ? 'text-[#4CAF50]' : ''}`}>
                      Horizontal
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View>
                <View className="items-center">
                  <Text className="text-white text-lg font-bold text-center bg-black/70 p-3 rounded-lg">
                    {getPhotoInstructions()}
                  </Text>
                  <Text className="text-white text-base mt-2 bg-black/70 p-2 rounded">
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
          </>
        )}
        {showManualBoundingBox && capturedPhotos[currentPhotoIndex] ? (
          <View className="flex-1 bg-black">
            <AppHeader title="Manual Selection" showBack={true} />
            <ManualBoundingBox
              imageUri={capturedPhotos[currentPhotoIndex].photo.uri}
              onBoundingBoxSelected={handleManualBoundingBox}
            />
            {isProcessing && (
              <View className="absolute inset-0 justify-center items-center bg-black/50">
                <ActivityIndicator size="large" color="#FFF" />
                <Text className="text-white text-lg font-bold mt-4">{pictureStatus}</Text>
              </View>
            )}
          </View>
        ) : renderPhotoPreview()}
      </View>
    </View>
  );
}
