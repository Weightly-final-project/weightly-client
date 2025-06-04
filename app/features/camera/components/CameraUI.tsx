import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { CapturedPhoto, PhotoMode, Split } from '../types';
import { logger } from '../utils/logger';
import { GyroGuide } from '../../../../components/GyroGuide';
import { OrientationGuide } from '../../../../components/OrientationGuide';
import CameraControls from '../../../../components/CameraControls';
import { Dispatch, SetStateAction } from 'react';


interface CameraUIProps {
  cameraRef: React.RefObject<CameraView>;
  mode: PhotoMode;
  splits: Split;
  maxProgress: number;
  statusProgress: number;
  isProcessing: boolean;
  pictureStatus: string;
  isGyroValid: boolean;
  isOrientationValid: boolean;
  capturedPhotos: CapturedPhoto[];
  currentPhotoIndex: number;
  onCapture: () => void;
  onPickImage: (photo: any) => void;
  setSplits: Dispatch<SetStateAction<Split>>;
  setIsGyroValid: React.Dispatch<React.SetStateAction<boolean>>;
  setIsOrientationValid: React.Dispatch<React.SetStateAction<boolean>>;
  onRetake: (index: number) => void;
}

export function CameraUI({
  cameraRef,
  mode,
  splits,
  isProcessing,
  pictureStatus,
  isGyroValid,
  maxProgress,
  statusProgress,
  isOrientationValid,
  capturedPhotos,
  currentPhotoIndex,
  onCapture,
  onPickImage,
  setSplits,
  setIsGyroValid,
  setIsOrientationValid,
  onRetake,
}: CameraUIProps) {
  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
        />
        <View style={styles.rectangle} />
        <View style={styles.cage}>
          {Array.from({ length: splits.x_splits + 1 }, (_, i) => (
            <View
              key={`v-${i}`}
              style={[styles.gridCell, {
                left: (Dimensions.get('window').width / splits.x_splits) * i,
                height: Dimensions.get('window').height,
                width: 2,
              }]}
            />
          ))}
          {Array.from({ length: splits.y_splits + 1 }, (_, i) => (
            <View
              key={`h-${i}`}
              style={[styles.gridCell, {
                top: (Dimensions.get('window').height / splits.y_splits) * i,
                width: Dimensions.get('window').width,
                height: 2,
              }]}
            />
          ))}
        </View>

        <View style={styles.cameraOverlay}>
          <View style={styles.guideContainer}>
            <GyroGuide onGyroValid={setIsGyroValid} />
            <OrientationGuide onOrientationValid={setIsOrientationValid} />
          </View>

          <View>
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                {mode === 'front' ? "Take a front photo of the object" : "Take a side photo of the object."}
              </Text>
              <Text style={styles.photoCountText}>
                Take photo inside the rectangle
              </Text>
            </View>
            <CameraControls
              onCapture={onCapture}
              onPickImage={onPickImage}
              setSplits={setSplits}
              splits={splits}
              isProcessing={isProcessing}
              isOrientationValid={isOrientationValid}
            />
          </View>
        </View>

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
                        onPress={() => onRetake(index)}
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
            <Text style={styles.processingText}>{statusProgress} out of {maxProgress}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  rectangle: {
    position: "absolute",
    top: Dimensions.get('window').height * (4 / 27),
    left: Dimensions.get('window').width * (1 / 9),
    width: Dimensions.get('window').width * (7 / 9),
    height: Dimensions.get('window').height * (16 / 27),
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 12,
    zIndex: 0,
  },
  cage: {
    position: "absolute",
    left: 0,
    top: 0,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    zIndex: 0,
  },
  gridCell: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
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
  previewOverlayContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'transparent',
  },
  previewScroll: {
    flex: 1,
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
}); 