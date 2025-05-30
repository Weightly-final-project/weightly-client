import React, { useRef, useEffect } from 'react';
import { View, Alert, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Buffer } from 'buffer';
import { useAuth } from '../../../../utils/AuthContext';
import { logger } from '../utils/logger';
import { CameraUI } from '../components/CameraUI';
import { useCameraState } from '../hooks/useCameraState';
import { usePhotoProcessing } from '../hooks/usePhotoProcessing';
import Permission from '../../../../components/Permission';
import AppHeader from '../../../../components/AppHeader';
import { CapturedPhoto } from '../types';
import { ManualBoundingBox } from '../../../../components/ManualBoundingBox';

function useNavigationState() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const navigationState = React.useMemo(() => {
    // logger.debug('Initializing navigation state', { params });
    
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

function CameraScreenContent() {
  const {
    router,
    params,
    userId,
    isSinglePhotoMode,
    existingPhotos: initialExistingPhotos,
    photoIndex: initialPhotoIndex,
  } = useNavigationState();

  const flowMode = (params.mode as 'ai' | 'manual') || 'ai';

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermissions] = useCameraPermissions();

  const {
    pictureStatus,
    setPictureStatus,
    isProcessing,
    setIsProcessing,
    showManualBoundingBox,
    setShowManualBoundingBox,
    isGyroValid,
    setIsGyroValid,
    isOrientationValid,
    setIsOrientationValid,
    mode,
    capturedPhotos,
    setCapturedPhotos,
    currentPhotoIndex,
    setCurrentPhotoIndex,
    splits,
    setSplits,
  } = useCameraState(initialExistingPhotos, initialPhotoIndex);

  const navigateToPrediction = React.useCallback((processedPhotos: CapturedPhoto[]) => {
    const lastPhoto = processedPhotos[processedPhotos.length - 1];
    // Only navigate to prediction when we have both photos processed
    if (processedPhotos.length < 2) {
      logger.info('Waiting for second photo before navigation');
      return;
    }
    
    if (!lastPhoto?.annotatedImage?.image_s3_uri || !lastPhoto?.annotatedImage?.annotated_s3_uri) {
      logger.warn('Cannot navigate to prediction - missing required photo data');
      return;
    }

    logger.info('Navigating to prediction screen', { 
      photosCount: processedPhotos.length 
    });

    router.replace({
      pathname: "/confirm-photos",
      params: {
        photos: Buffer.from(JSON.stringify(processedPhotos)).toString("base64"),
        predictions: params.predictions || JSON.stringify(lastPhoto.annotatedImage.predictions),
      },
    });
  }, [router, params.predictions]);

  // Handle return from manual bounding box or ImageAnnotationScreen
  useEffect(() => {
    // Check if we have the necessary data and a relevant mode from navigation params
    if (params.bboxData && params.processedImageUri &&
        (params.mode === 'reference' || params.mode === 'manual_capture')) {

      const photoIndexToUpdate = params.returnedPhotoIndex ? parseInt(params.returnedPhotoIndex as string) : currentPhotoIndex;

      logger.debug(`Received manual annotation data for mode: ${params.mode}`, {
        boxCount: JSON.parse(params.bboxData as string).length,
        photoIndexProcessed: photoIndexToUpdate,
        totalPhotosInState: capturedPhotos.length,
        photoUri: params.processedImageUri,
      });

      const boxes = JSON.parse(params.bboxData as string);

      // Specific validation for 'reference' mode
      if (params.mode === 'reference' && boxes.length !== 1) {
        logger.warn('Reference object annotation requires exactly one box.', { boxCount: boxes.length });
        Alert.alert("Error", "Reference object annotation requires one box. Please try again.");
        router.setParams({ // Clear params to prevent re-triggering
            bboxData: undefined,
            processedImageUri: undefined,
            mode: undefined,
            returnedPhotoIndex: undefined
        });
        return;
      }

      // For 'manual_capture', ImageAnnotationScreen should handle its own box limits.
      // We proceed to update the photo data.

      const updatedPhotos = [...capturedPhotos];
      if (updatedPhotos[photoIndexToUpdate]) {
        updatedPhotos[photoIndexToUpdate] = {
          ...updatedPhotos[photoIndexToUpdate],
          photo: { // Ensure photo object with its URI is preserved or correctly set
            ...updatedPhotos[photoIndexToUpdate].photo,
            uri: updatedPhotos[photoIndexToUpdate].photo.uri, // This should be the original captured photo URI
          },
          processed: true,
          annotatedImage: {
            image_s3_uri: updatedPhotos[photoIndexToUpdate].photo.uri, // Original URI
            annotated_s3_uri: params.processedImageUri as string,      // URI that was annotated (can be same as original)
            predictions: boxes // The bounding boxes from annotation
          }
        };
        setCapturedPhotos(updatedPhotos);

        // Clear the navigation params to prevent this useEffect from re-running with stale data
        router.setParams({
            bboxData: undefined,
            processedImageUri: undefined,
            mode: undefined,
            returnedPhotoIndex: undefined
        });

        // Navigation logic: check if all photos are processed or move to the next
        const allPhotosProcessed = updatedPhotos.length === 2 &&
          updatedPhotos.every(p => p?.processed);

        if (allPhotosProcessed) {
          logger.info('Both photos processed (after manual annotation), navigating to prediction');
          navigateToPrediction(updatedPhotos);
        } else if (photoIndexToUpdate === 0 && updatedPhotos.length < 2) {
          // If this was the first photo and we need a second one
          setCurrentPhotoIndex(1);
          setPictureStatus("Please take the second photo");
        } else if (photoIndexToUpdate === 0 && updatedPhotos.length === 2 && !updatedPhotos[1]?.processed) {
            // If this was the first photo, second slot exists but not processed
            setCurrentPhotoIndex(1);
            setPictureStatus("Please take the second photo");
        } else if (photoIndexToUpdate === 1 && !updatedPhotos[0]?.processed) {
          // This was the second photo, but the first is somehow not processed (edge case)
          logger.warn('Second photo annotated, but first is not processed. Waiting for first photo.');
          setCurrentPhotoIndex(0); // Prompt for first photo again or handle error
          setPictureStatus("Please process the first photo.");
        } else {
          // This case might be redundant if allPhotosProcessed covers it,
          // or handles single photo mode if that's ever a factor here.
          logger.debug('Manual annotation processed. State:', { photoIndexToUpdate, numCaptured: updatedPhotos.length, allProcessed: allPhotosProcessed });
        }
      } else {
        logger.warn('Photo not found at photoIndexToUpdate for manual annotation.', { photoIndexToUpdate });
        router.setParams({ // Clear params to avoid loop if index is bad
            bboxData: undefined,
            processedImageUri: undefined,
            mode: undefined,
            returnedPhotoIndex: undefined
        });
      }
    }
  }, [
    params.bboxData,
    params.processedImageUri,
    params.mode,
    params.returnedPhotoIndex, // New dependency
    currentPhotoIndex,
    capturedPhotos,
    navigateToPrediction,
    setCapturedPhotos,
    setCurrentPhotoIndex,
    setPictureStatus,
    router // Added router as a dependency because of setParams
  ]);

  const requiredPhotos = React.useMemo(() => 
    isSinglePhotoMode ? currentPhotoIndex + 1 : 2,
    [isSinglePhotoMode, currentPhotoIndex]
  );

  const { processPhoto } = usePhotoProcessing({
    userId,
    currentPhotoIndex,
    capturedPhotos,
    splits,
    setPictureStatus,
    setIsProcessing,
    setShowManualBoundingBox,
    setCapturedPhotos,
    onProcessingComplete: (photos) => {
      // Check if we have both photos processed
      const allPhotosProcessed = photos.length === 2 && 
        photos[0]?.processed && 
        photos[1]?.processed;

      if (allPhotosProcessed) {
        // If both photos are processed, navigate to prediction
        navigateToPrediction(photos);
      } else if (currentPhotoIndex === 0) {
        // If this was the first photo, prepare for second
        setCurrentPhotoIndex(1);
        setPictureStatus("Please take the second photo");
      }
    },
  });

  const handleCapture = React.useCallback(async () => {
    // Don't allow capturing more than 2 photos
    if (capturedPhotos.length >= 2 && capturedPhotos[0]?.processed && capturedPhotos[1]?.processed) {
      logger.info('Already have two processed photos, ignoring capture');
      return;
    }

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
      logger.debug('Taking picture', { 
        mode, 
        currentPhotoIndex,
        totalPhotos: capturedPhotos.length
      });
      
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
      
      if (flowMode === 'ai') {
        await processPhoto(newPhoto);
      } else { // Manual flow: Navigate to ImageAnnotationScreen
        setIsProcessing(false);
        const currentPhotoUri = updatedPhotos[currentPhotoIndex].photo.uri;
        logger.info('Manual flow: Navigating to ImageAnnotationScreen', {
          currentPhotoIndex,
          uri: currentPhotoUri,
          photosStateBeingSent: updatedPhotos.map(p => ({uri: p.photo.uri, processed: p.processed}))
        });
        router.push({
          pathname: '/ImageAnnotationScreen', 
          params: {
            imageUri: currentPhotoUri, 
            processedImageUri: currentPhotoUri, 
            mode: 'manual_capture', 
            currentPhotoIndexForAnnotation: currentPhotoIndex.toString(), 
            photosToCarryForward: Buffer.from(JSON.stringify(updatedPhotos)).toString("base64"),
          },
        });
      }
    }
  }, [
    isGyroValid,
    isOrientationValid,
    mode,
    currentPhotoIndex,
    capturedPhotos,
    processPhoto,
    setCapturedPhotos,
    setPictureStatus,
    setIsProcessing,
    setShowManualBoundingBox,
    flowMode,
    router
  ]);

  const handleRetake = React.useCallback((index: number) => {
    logger.debug('Retaking photo', { index });
    const newPhotos = [...capturedPhotos];
    newPhotos.splice(index);
    setCapturedPhotos(newPhotos);
    setCurrentPhotoIndex(index);
  }, [capturedPhotos, setCapturedPhotos, setCurrentPhotoIndex]);

  if (!permission || !permission.granted) {
    return (
      <View style={{ flex: 1 }}>
        <AppHeader title="Camera" showBack={true} />
        <Permission
          permissionType={"camera"}
          requestPermissions={requestPermissions}
        />
      </View>
    );
  }

  // Show ManualBoundingBox when needed in AI flow
  if (showManualBoundingBox && flowMode === 'ai' && currentPhotoIndex < capturedPhotos.length) {
    const currentPhoto = capturedPhotos[currentPhotoIndex];
    return (
      <ManualBoundingBox
        imageUri={currentPhoto.photo.uri}
        onBoundingBoxSelected={(bbox) => {
          const updatedPhotos = [...capturedPhotos];
          updatedPhotos[currentPhotoIndex] = {
            ...currentPhoto,
            processed: true,
            annotatedImage: {
              image_s3_uri: currentPhoto.photo.uri,
              annotated_s3_uri: currentPhoto.photo.uri,
              predictions: [{
                x: bbox.minX,
                y: bbox.minY,
                width: bbox.maxX - bbox.minX,
                height: bbox.maxY - bbox.minY
              }]
            }
          };
          setCapturedPhotos(updatedPhotos);
          setShowManualBoundingBox(false);

          // Check if we should proceed to next photo or finish
          if (currentPhotoIndex === 0) {
            setCurrentPhotoIndex(1);
            setPictureStatus("Please take the second photo");
          } else if (currentPhotoIndex === 1) {
            navigateToPrediction(updatedPhotos);
          }
        }}
        onCancel={() => {
          setShowManualBoundingBox(false);
          // Remove the failed photo
          const newPhotos = [...capturedPhotos];
          newPhotos.splice(currentPhotoIndex, 1);
          setCapturedPhotos(newPhotos);
          setPictureStatus("Please try again");
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <AppHeader title="Camera" showBack={true} />
      
      <CameraUI
        cameraRef={cameraRef as React.RefObject<CameraView>}
        mode={mode}
        splits={splits}
        isProcessing={isProcessing}
        pictureStatus={pictureStatus}
        isGyroValid={isGyroValid}
        isOrientationValid={isOrientationValid}
        capturedPhotos={capturedPhotos}
        currentPhotoIndex={currentPhotoIndex}
        onCapture={handleCapture}
        onPickImage={(photo) => {
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
        setSplits={setSplits}
        setIsGyroValid={setIsGyroValid}
        setIsOrientationValid={setIsOrientationValid}
        onRetake={handleRetake}
      />
    </View>
  );
}

export default function CameraScreen() {
  logger.debug('Rendering CameraScreen');
  return <CameraScreenContent />;
} 