import { useState } from 'react';
import { CameraCapturedPicture } from 'expo-camera';
import { Split, PhotoMode, CapturedPhoto, defaultSplitsConfig } from '../types';
import { logger } from '../utils/logger';

export function useCameraState(initialExistingPhotos: CapturedPhoto[] = [], initialPhotoIndex: number = 0) {
  // logger.debug('Initializing camera state', { initialPhotoIndex, photosCount: initialExistingPhotos.length });
  
  const [pictureStatus, setPictureStatus] = useState<string>("Ready to capture");
  const [statusProgress, setStatusProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showManualBoundingBox, setShowManualBoundingBox] = useState(false);
  const [isGyroValid, setIsGyroValid] = useState(false);
  const [isOrientationValid, setIsOrientationValid] = useState(false);
  const [mode, setMode] = useState<PhotoMode>('front');
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>(initialExistingPhotos);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(initialPhotoIndex);
  const [splits, setSplits] = useState<Split>(defaultSplitsConfig['front']);

  const maxProgress = 4;

  const updateMode = (newMode: PhotoMode) => {
    logger.debug('Updating camera mode', { currentMode: mode, newMode });
    setMode(newMode);
    setSplits(defaultSplitsConfig[newMode]);
  };

  const updatePhotoIndex = (index: number) => {
    logger.debug('Updating photo index', { currentIndex: currentPhotoIndex, newIndex: index });
    setCurrentPhotoIndex(index);
    updateMode(index === 0 ? 'front' : 'side');
  };

  const updatePhotos = (photos: CapturedPhoto[]) => {
    logger.debug('Updating captured photos', { 
      currentCount: capturedPhotos.length, 
      newCount: photos.length 
    });
    setCapturedPhotos(photos);
  };

  return {
    pictureStatus,
    setPictureStatus,
    maxProgress,
    statusProgress,
    setStatusProgress,
    isProcessing,
    setIsProcessing,
    showManualBoundingBox,
    setShowManualBoundingBox,
    isGyroValid,
    setIsGyroValid,
    isOrientationValid,
    setIsOrientationValid,
    mode,
    setMode: updateMode,
    capturedPhotos,
    setCapturedPhotos: updatePhotos,
    currentPhotoIndex,
    setCurrentPhotoIndex: updatePhotoIndex,
    splits,
    setSplits,
  };
} 