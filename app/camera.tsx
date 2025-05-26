import type React from "react";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { getFile, uploadFile } from "../utils/s3";
import { hooks } from "../utils/api";
import Permission from "../components/Permission";
import { Buffer } from "buffer";
import { bigBboxCalculator } from "../utils/functions";
import CameraControls from "../components/CameraControls";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../utils/AuthContext";
import { ManualBoundingBox } from "../components/ManualBoundingBox";
import { GyroGuide } from "../components/GyroGuide";
import { OrientationGuide } from "../components/OrientationGuide";

// Use your API hooks
const {
  usePredictMutation,
  useOutput_imageMutation,
  useReference_calculatorMutation,
  useBbox_refinementMutation,
} = hooks;

type PhotoMode = 'front' | 'side';

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

export type Split = {
  x_splits: number;
  y_splits: number;
  confidenceThreshold: number;
};

interface PhotoToProcess {
  photo: CameraCapturedPicture | undefined;
  processed?: boolean;
  annotatedImage?: {
    image_s3_uri: string;
    annotated_s3_uri: string;
    predictions: any[];
  };
}

const defaultSplitsConfig: { [key in PhotoMode]: Split } = {
  'front': {
    x_splits: 1,
    y_splits: 1,
    confidenceThreshold: 0.5,
  },
  'side': {
    x_splits: 7,
    y_splits: 2,
    confidenceThreshold: 0.3,
  },
};

// Custom hook to handle all navigation-related state
function useNavigationState() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  // Memoize the values we derive from params
  const navigationState = useMemo(() => {
    const isSinglePhotoMode = params.singlePhotoMode === "true";
    const userId = user?.username || "guest";
    
    return {
      router,
      params,
      userId,
      isSinglePhotoMode,
      existingPhotos: params.existingPhotos ? 
        JSON.parse(Buffer.from(params.existingPhotos as string, 'base64').toString()) : 
        [],
      photoIndex: params.photoIndex ? parseInt(params.photoIndex as string) : 0,
    };
  }, [router, params, user]);

  return navigationState;
}

// Separate the main camera screen logic into its own component
function CameraScreenContent() {
  const {
    router,
    params,
    userId,
    isSinglePhotoMode,
    existingPhotos: initialExistingPhotos,
    photoIndex: initialPhotoIndex,
  } = useNavigationState();
  const { user } = useAuth();
  
  // Initialize all state first, before any conditional logic
  const [pictureStatus, setPictureStatus] = useState<string>("Ready to capture");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showManualBoundingBox, setShowManualBoundingBox] = useState(false);
  const [isGyroValid, setIsGyroValid] = useState(false);
  const [isOrientationValid, setIsOrientationValid] = useState(false);
  const [mode, setMode] = useState<PhotoMode>('front');
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>(initialExistingPhotos);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(initialPhotoIndex);
  const [splits, setSplits] = useState<Split>(defaultSplitsConfig['front']);

  const [permission, requestPermissions] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Initialize mutations
  const predictMutation = usePredictMutation();
  const outputImageMutation = useOutput_imageMutation();
  const referenceCalculatorMutation = useReference_calculatorMutation();
  const bboxRefinementMutation = useBbox_refinementMutation();

  // Memoize derived values
  const requiredPhotos = useMemo(() => 
    isSinglePhotoMode ? currentPhotoIndex + 1 : 2,
    [isSinglePhotoMode, currentPhotoIndex]
  );

  // Navigation helper
  const navigateToPrediction = useCallback((processedPhotos: CapturedPhoto[]) => {
    const lastPhoto = processedPhotos[processedPhotos.length - 1];
    if (!lastPhoto?.annotatedImage?.image_s3_uri || !lastPhoto?.annotatedImage?.annotated_s3_uri) return;

    router.replace({
      pathname: "/confirm-photos",
      params: {
        photos: Buffer.from(JSON.stringify(processedPhotos)).toString("base64"),
        predictions: params.predictions || JSON.stringify(lastPhoto.annotatedImage.predictions),
      },
    });
  }, [router, params.predictions]);

  // Define processAnnotationData with access to all required values
  const processAnnotationData = useCallback(async (bboxDataString: string, imageUriFromAnnotation: string) => {
    setIsProcessing(true);
    setPictureStatus("Processing manual drawing...");

    try {
      const drawnBoxes = JSON.parse(bboxDataString);
      if (!drawnBoxes || drawnBoxes.length === 0) {
        Alert.alert("No Bounding Boxes", "No bounding boxes were drawn.");
        return;
      }

      const photoToUpdate = capturedPhotos[currentPhotoIndex];
      if (!photoToUpdate || photoToUpdate.photo.uri !== imageUriFromAnnotation) {
        Alert.alert("Error", "Photo mismatch when processing manual drawing.");
        return;
      }

      const s3UploadResponse = await uploadFile(
        imageUriFromAnnotation,
        `original_images/${userId}_${Date.now()}_annotated_image${currentPhotoIndex + 1}.jpg`
      );
      const imageS3Uri = `s3://weighlty/${s3UploadResponse.Key}`;

      let finalPredictions: any[] = [];
      const rubiksCubeBox = drawnBoxes.find((b: any) => b.label === "Rubkis cube");
      const woodStackBox = drawnBoxes.find((b: any) => b.label === "wood stack");

      if (rubiksCubeBox && woodStackBox) {
        setPictureStatus("Calculating size with reference object...");
        const referenceObjectForCalc = {
          bbox: [rubiksCubeBox.x, rubiksCubeBox.y, rubiksCubeBox.x + rubiksCubeBox.width, rubiksCubeBox.y + rubiksCubeBox.height],
          object: "rubiks_cube",
          confidence: 1.0,
        };

        let refinedReferenceBbox = referenceObjectForCalc.bbox;
        try {
          const refinedResult = await bboxRefinementMutation.mutateAsync({
            bbox: referenceObjectForCalc.bbox,
            image_s3_uri: imageS3Uri,
          }) as any;
          refinedReferenceBbox = refinedResult.refined_bbox || referenceObjectForCalc.bbox;
        } catch (refineError) {
          console.warn("BBox refinement for Rubik's cube failed:", refineError);
        }

        const woodStackForCalc = {
          bbox: [woodStackBox.x, woodStackBox.y, woodStackBox.x + woodStackBox.width, woodStackBox.y + woodStackBox.height],
          object: "pine",
          confidence: 1.0,
        };

        const predictionsWithSize = await referenceCalculatorMutation.mutateAsync({
          predictions: [woodStackForCalc],
          reference_width_cm: 5.8,
          reference_width_px: refinedReferenceBbox[2] - refinedReferenceBbox[0],
          focal_length_px: 10,
          reference_height_px: refinedReferenceBbox[3] - refinedReferenceBbox[1],
        });

        finalPredictions = [
          ...Array.from(predictionsWithSize, x => ({ ...x })),
          { ...referenceObjectForCalc, bbox: refinedReferenceBbox },
        ];
      } else {
        finalPredictions = drawnBoxes.map((box: any) => ({
          bbox: [box.x, box.y, box.x + box.width, box.y + box.height],
          object: box.label === "Rubkis cube" ? "rubiks_cube" : "pine",
          confidence: 1.0,
        }));
      }

      setPictureStatus("Generating annotated image from drawing...");
      const outputImageResult = await outputImageMutation.mutateAsync({
        user: userId,
        image_s3_uri: imageS3Uri,
        predictions: finalPredictions,
      });

      if (outputImageResult.annotated_s3_uri) {
        const downloadAnnotatedS3 = await getFile(
          outputImageResult.annotated_s3_uri.split('/').splice(3).join('/')
        );
        const updatedPhotos = [...capturedPhotos];
        updatedPhotos[currentPhotoIndex] = {
          ...photoToUpdate,
          processed: true,
          annotatedImage: {
            image_s3_uri: imageS3Uri,
            annotated_s3_uri: outputImageResult.annotated_s3_uri,
            download_annotated_s3_uri: downloadAnnotatedS3?.url,
            predictions: finalPredictions,
          },
        };
        setCapturedPhotos(updatedPhotos);

        if (currentPhotoIndex + 1 < requiredPhotos) {
          setCurrentPhotoIndex(currentPhotoIndex + 1);
          setMode(mode === 'front' ? 'side' : 'front');
        } else {
          navigateToPrediction(updatedPhotos);
        }
      }
    } catch (error) {
      console.error("Error processing annotation data:", error);
      Alert.alert("Processing Error", `Error processing manual drawing: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [
    userId,
    currentPhotoIndex,
    requiredPhotos,
    capturedPhotos,
    mode,
    bboxRefinementMutation,
    referenceCalculatorMutation,
    outputImageMutation,
    navigateToPrediction
  ]);

  // Handle initial params in a single effect
  useEffect(() => {
    try {
      if (params.existingPhotos) {
        const decodedPhotos = JSON.parse(Buffer.from(params.existingPhotos as string, 'base64').toString());
        setCapturedPhotos(decodedPhotos);
      }
      if (params.photoIndex) {
        const index = parseInt(params.photoIndex as string);
        setCurrentPhotoIndex(index);
        setMode(index === 0 ? 'front' : 'side');
      }
    } catch (error) {
      console.error('Error loading existing photos:', error);
    }
  }, [params.existingPhotos, params.photoIndex]);

  // Handle splits based on mode
  useEffect(() => {
    setSplits(defaultSplitsConfig[mode]);
  }, [mode]);

  // Handle annotation data in a single effect
  useEffect(() => {
    if (!params.bboxData || !params.processedImageUri) return;

    const processData = async () => {
      try {
        await processAnnotationData(params.bboxData as string, params.processedImageUri as string);
      } finally {
        router.setParams({ 
          bboxData: undefined, 
          processedImageUri: undefined 
        });
      }
    };

    processData();
  }, [params.bboxData, params.processedImageUri, processAnnotationData, router]);

  // Memoize derived values
  const getPhotoInstructions = () => {
    if (mode === 'front') {
      return "Take a front photo of the object";
    }
    return `Take a side photo of the object.`;
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
      const { x_splits, y_splits, confidenceThreshold } = splits;

      const formData1 = {
        user: userId,
        image_s3_uri: `s3://weighlty/${res1.Key}`,
        model_s3_uri: "s3://weighlty/pine.pt",
        x_splits,
        y_splits,
      } as const;

      const formData2 = {
        user: userId,
        image_s3_uri: `s3://weighlty/${res1.Key}`,
        model_s3_uri: "s3://rbuixcube/large_files/best.pt",
        x_splits,
        y_splits,
      } as const;

      setPictureStatus("Processing image...");

      const prediction = await predictMutation.mutateAsync(formData1);
      const reference_prediction = await predictMutation.mutateAsync(formData2);

      console.log('Prediction results:', prediction.predictions);

      const reference_object = reference_prediction.predictions?.find(
        (obj: any) => obj.object === "rubiks_cube"
      );

      if (
        reference_prediction.predictions &&
        reference_prediction.predictions.length > 0 &&
        reference_object &&
        Array.isArray(reference_object.bbox) &&
        reference_object.bbox.length === 4 &&
        reference_object.bbox.every((v: any) => typeof v === 'number')
      ) {
        try {
          const reference_bbox_refine = await bboxRefinementMutation.mutateAsync({
            bbox: reference_object?.bbox || [],
            image_s3_uri: `s3://weighlty/${res1.Key}`,
          } as const);

          const parsedPredictions = prediction.predictions.filter(
            (prediction) => prediction.confidence >= confidenceThreshold
          );
          const bbox = bigBboxCalculator(parsedPredictions);

          setPictureStatus("Analyzing objects...");

          // Log detection information for debugging
          console.log('Detection status:', {
            photoIndex: currentPhotoIndex,
            foundPredictions: parsedPredictions && parsedPredictions.length > 0,
            foundBbox: !!bbox,
            hasReferenceObject: !!reference_object,
            referenceObjectBbox: reference_bbox_refine,
          });
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
    if (!isGyroValid) {
      Alert.alert(
        "Incorrect Angle",
        "Please hold your phone at the correct angle before taking the picture.",
        [{ text: "OK" }]
      );
      return;
    }
    if (!isOrientationValid) {
      Alert.alert(
        "Incorrect Orientation",
        "Please hold your phone horizontaly before taking the picture.",
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
      
      // Ask user for processing method upfront
      Alert.alert(
        "Choose Processing Method",
        "How would you like to process the objects in this image?",
        [
          {
            text: "AI (Automatic)",
            onPress: async () => {
              await processPhoto(newPhoto); // This contains its own fallback to ManualBoundingBox
              // Mode setting for next photo is handled within processPhoto on AI success
            }
          },
          {
            text: "Manual Drawing",
            onPress: () => {
              setIsProcessing(false); 
              setPictureStatus("Waiting for manual annotation...");
              router.push({ 
                  pathname: '/ImageAnnotationScreen', 
                  params: { imageUri: photo.uri } 
              });
            }
          },
          {
            text: "Cancel",
            onPress: () => {
                // User cancelled, remove the photo just added if it shouldn't persist
                const newPhotos = capturedPhotos.filter((_, idx) => idx !== currentPhotoIndex);
                setCapturedPhotos(newPhotos);
                if (currentPhotoIndex === 0 && newPhotos.length === 0) {
                    setMode('front'); // Reset to front if it was the first and only photo
                }
                // Adjust currentPhotoIndex if needed, though typically it might stay for a retake
                setPictureStatus("Capture canceled. Ready to capture.");
            },
            style: "cancel"
          }
        ]
      );
    }
  };

  const handleLegacyManualBoxSelected = async (bbox: { minX: number, minY: number, maxX: number, maxY: number }) => {
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <AppHeader title="Camera" showBack={true} />

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
        />
        <View style={styles.rectangle}></View>
        <View style={styles.cage}>
          {Array.from({ length: splits.x_splits + 1 }, (_, i) => (
            <View
              key={`v-${i}`}
              style={[styles.gridCell, {
                left: (width / splits.x_splits) * i,
                height,
                width: 2,
              }]}
            />
          ))}
          {Array.from({ length: splits.y_splits + 1 }, (_, i) => (
            <View
              key={`h-${i}`}
              style={[styles.gridCell, {
                top: (height / splits.y_splits) * i,
                width,
                height: 2,
              }]}
            />
          ))}
        </View>
        <View style={styles.cameraOverlay}>
          <View style={styles.guideContainer}>
            <GyroGuide
              onGyroValid={setIsGyroValid}
            />
            <OrientationGuide
              onOrientationValid={setIsOrientationValid}
            />
          </View>
          <View style={styles.buttonContainer}>
          </View>
          <View>
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>{getPhotoInstructions()}</Text>
              <Text style={styles.photoCountText}>
                Take photo inside the rectangle
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
                setMode('side');
              }}
              setSplits={setSplits}
              splits={splits}
              isProcessing={isProcessing}
              isOrientationValid={isOrientationValid}
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
                          setMode(newPhotos.length == 0 ? 'front' : 'side');
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
              onBoundingBoxSelected={handleLegacyManualBoxSelected}
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

// Main export wraps the content in a stable initialization check
export default function CameraScreen() {
  // Core hooks that must be called every render
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const userId = user?.username || "guest";

  // Initialize all state first
  const [pictureStatus, setPictureStatus] = useState<string>("Ready to capture");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showManualBoundingBox, setShowManualBoundingBox] = useState(false);
  const [isGyroValid, setIsGyroValid] = useState(false);
  const [isOrientationValid, setIsOrientationValid] = useState(false);
  const [mode, setMode] = useState<PhotoMode>('front');
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
  const [splits, setSplits] = useState<Split>(defaultSplitsConfig['front']);

  // Camera permissions and ref
  const [permission, requestPermissions] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Initialize mutations
  const predictMutation = usePredictMutation();
  const outputImageMutation = useOutput_imageMutation();
  const referenceCalculatorMutation = useReference_calculatorMutation();
  const bboxRefinementMutation = useBbox_refinementMutation();

  // Memoize derived values
  const isSinglePhotoMode = useMemo(() => params.singlePhotoMode === "true", [params.singlePhotoMode]);
  const requiredPhotos = useMemo(() => 
    isSinglePhotoMode ? currentPhotoIndex + 1 : 2,
    [isSinglePhotoMode, currentPhotoIndex]
  );

  // Navigation helper
  const navigateToPrediction = useCallback((processedPhotos: CapturedPhoto[]) => {
    const lastPhoto = processedPhotos[processedPhotos.length - 1];
    if (!lastPhoto?.annotatedImage?.image_s3_uri || !lastPhoto?.annotatedImage?.annotated_s3_uri) return;

    router.replace({
      pathname: "/confirm-photos",
      params: {
        photos: Buffer.from(JSON.stringify(processedPhotos)).toString("base64"),
        predictions: params.predictions || JSON.stringify(lastPhoto.annotatedImage.predictions),
      },
    });
  }, [router, params.predictions]);

  // Handle initial params
  useEffect(() => {
    try {
      if (params.existingPhotos) {
        const decodedPhotos = JSON.parse(Buffer.from(params.existingPhotos as string, 'base64').toString());
        setCapturedPhotos(decodedPhotos);
      }
      if (params.photoIndex) {
        const index = parseInt(params.photoIndex as string);
        setCurrentPhotoIndex(index);
        setMode(index === 0 ? 'front' : 'side');
      }
    } catch (error) {
      console.error('Error loading existing photos:', error);
    }
  }, [params.existingPhotos, params.photoIndex]);

  // Handle splits based on mode
  useEffect(() => {
    setSplits(defaultSplitsConfig[mode]);
  }, [mode]);

  // Process annotation data
  const processAnnotationData = useCallback(async (bboxDataString: string, imageUriFromAnnotation: string) => {
    setIsProcessing(true);
    setPictureStatus("Processing manual drawing...");

    try {
      const drawnBoxes = JSON.parse(bboxDataString);
      if (!drawnBoxes || drawnBoxes.length === 0) {
        Alert.alert("No Bounding Boxes", "No bounding boxes were drawn.");
        return;
      }

      const photoToUpdate = capturedPhotos[currentPhotoIndex];
      if (!photoToUpdate || photoToUpdate.photo.uri !== imageUriFromAnnotation) {
        Alert.alert("Error", "Photo mismatch when processing manual drawing.");
        return;
      }

      const s3UploadResponse = await uploadFile(
        imageUriFromAnnotation,
        `original_images/${userId}_${Date.now()}_annotated_image${currentPhotoIndex + 1}.jpg`
      );
      const imageS3Uri = `s3://weighlty/${s3UploadResponse.Key}`;

      let finalPredictions: any[] = [];
      const rubiksCubeBox = drawnBoxes.find((b: any) => b.label === "Rubkis cube");
      const woodStackBox = drawnBoxes.find((b: any) => b.label === "wood stack");

      if (rubiksCubeBox && woodStackBox) {
        setPictureStatus("Calculating size with reference object...");
        const referenceObjectForCalc = {
          bbox: [rubiksCubeBox.x, rubiksCubeBox.y, rubiksCubeBox.x + rubiksCubeBox.width, rubiksCubeBox.y + rubiksCubeBox.height],
          object: "rubiks_cube",
          confidence: 1.0,
        };

        let refinedReferenceBbox = referenceObjectForCalc.bbox;
        try {
          const refinedResult = await bboxRefinementMutation.mutateAsync({
            bbox: referenceObjectForCalc.bbox,
            image_s3_uri: imageS3Uri,
          }) as any;
          refinedReferenceBbox = refinedResult.refined_bbox || referenceObjectForCalc.bbox;
        } catch (refineError) {
          console.warn("BBox refinement for Rubik's cube failed:", refineError);
        }

        const woodStackForCalc = {
          bbox: [woodStackBox.x, woodStackBox.y, woodStackBox.x + woodStackBox.width, woodStackBox.y + woodStackBox.height],
          object: "pine",
          confidence: 1.0,
        };

        const predictionsWithSize = await referenceCalculatorMutation.mutateAsync({
          predictions: [woodStackForCalc],
          reference_width_cm: 5.8,
          reference_width_px: refinedReferenceBbox[2] - refinedReferenceBbox[0],
          focal_length_px: 10,
          reference_height_px: refinedReferenceBbox[3] - refinedReferenceBbox[1],
        });

        finalPredictions = [
          ...Array.from(predictionsWithSize, x => ({ ...x })),
          { ...referenceObjectForCalc, bbox: refinedReferenceBbox },
        ];
      } else {
        finalPredictions = drawnBoxes.map((box: any) => ({
          bbox: [box.x, box.y, box.x + box.width, box.y + box.height],
          object: box.label === "Rubkis cube" ? "rubiks_cube" : "pine",
          confidence: 1.0,
        }));
      }

      setPictureStatus("Generating annotated image from drawing...");
      const outputImageResult = await outputImageMutation.mutateAsync({
        user: userId,
        image_s3_uri: imageS3Uri,
        predictions: finalPredictions,
      });

      if (outputImageResult.annotated_s3_uri) {
        const downloadAnnotatedS3 = await getFile(
          outputImageResult.annotated_s3_uri.split('/').splice(3).join('/')
        );
        const updatedPhotos = [...capturedPhotos];
        updatedPhotos[currentPhotoIndex] = {
          ...photoToUpdate,
          processed: true,
          annotatedImage: {
            image_s3_uri: imageS3Uri,
            annotated_s3_uri: outputImageResult.annotated_s3_uri,
            download_annotated_s3_uri: downloadAnnotatedS3?.url,
            predictions: finalPredictions,
          },
        };
        setCapturedPhotos(updatedPhotos);

        if (currentPhotoIndex + 1 < requiredPhotos) {
          setCurrentPhotoIndex(currentPhotoIndex + 1);
          setMode(mode === 'front' ? 'side' : 'front');
        } else {
          navigateToPrediction(updatedPhotos);
        }
      }
    } catch (error) {
      console.error("Error processing annotation data:", error);
      Alert.alert("Processing Error", `Error processing manual drawing: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [
    userId,
    currentPhotoIndex,
    requiredPhotos,
    capturedPhotos,
    mode,
    bboxRefinementMutation,
    referenceCalculatorMutation,
    outputImageMutation,
    navigateToPrediction
  ]);

  // Handle annotation data from params
  useEffect(() => {
    if (!params.bboxData || !params.processedImageUri) return;

    const processData = async () => {
      try {
        await processAnnotationData(params.bboxData as string, params.processedImageUri as string);
      } finally {
        router.setParams({ 
          bboxData: undefined, 
          processedImageUri: undefined 
        });
      }
    };

    processData();
  }, [params.bboxData, params.processedImageUri, processAnnotationData, router]);

  // Show loading state until we're ready
  if (!permission || !permission.granted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#FFF" />
        <Text style={{ color: '#FFF', marginTop: 10 }}>Loading camera...</Text>
      </View>
    );
  }

  return <CameraScreenContent />;
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
  rectangle: {
    position: "absolute",
    top: height * (4 / 27),
    left: width * (1 / 9),
    width: width * (7 / 9),
    height: height * (16 / 27),
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 12,
    zIndex: 0,
  },
  cage: {
    position: "absolute",
    left: 0,
    top: 0,
    width: width,
    height: height,
    zIndex: 0,
  },
  gridCell: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
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
  guideContainer: {
    flexDirection: "column",
    justifyContent: "center",
    gap: 8,
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
