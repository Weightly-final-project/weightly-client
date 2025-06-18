import { useCallback } from 'react';
import { hooks } from '../../../../utils/api';
import { uploadFile, getFile } from '../../../../utils/s3';
import { CapturedPhoto, PhotoToProcess, Split } from '../types';
import { logger } from '../utils/logger';
import { useRouter } from 'expo-router';
import { bigBboxCalculator } from '../../../../utils/functions';

const {
  usePredictMutation,
  useOutput_imageMutation,
  useReference_calculatorMutation,
  useBbox_refinementMutation,
  usePredict_countMutation
} = hooks;

interface UsePhotoProcessingProps {
  userId: string;
  currentPhotoIndex: number;
  capturedPhotos: CapturedPhoto[];
  splits: Split;
  setPictureStatus: (status: string) => void;
  setStatusProgress: (progress: number) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setShowManualBoundingBox: (show: boolean) => void;
  setCapturedPhotos: (photos: CapturedPhoto[]) => void;
  onProcessingComplete: (photos: CapturedPhoto[]) => void;
}

export function usePhotoProcessing({
  userId,
  currentPhotoIndex,
  capturedPhotos,
  splits,
  setPictureStatus,
  setStatusProgress,
  setIsProcessing,
  setShowManualBoundingBox,
  setCapturedPhotos,
  onProcessingComplete,
}: UsePhotoProcessingProps) {
  const router = useRouter();
  const predictMutation = usePredictMutation();
  const outputImageMutation = useOutput_imageMutation();
  const referenceCalculatorMutation = useReference_calculatorMutation();
  const bboxRefinementMutation = useBbox_refinementMutation();
  const predictCountMutation = usePredict_countMutation();

  const processPhoto = useCallback(async (photo: PhotoToProcess) => {
    if (!photo.photo) {
      logger.warn('No photo provided for processing');
      return false;
    }

    try {
      logger.info('Starting photo processing', { photoIndex: currentPhotoIndex });
      setIsProcessing(true);
      setPictureStatus("Uploading image...");
      setStatusProgress(1);

      const res1 = await uploadFile(
        photo.photo.uri,
        `original_images/${userId}_${Date.now()}_image${currentPhotoIndex + 1}.jpg`
      );
      logger.info('Image uploaded', { s3Key: res1.Key });

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
      setStatusProgress(2);
      logger.info('Starting object detection');

      const [prediction, reference_prediction] = await Promise.all([
        predictMutation.mutateAsync(formData1),
        !photo.manualReference ? predictMutation.mutateAsync(formData2) : Promise.resolve({ predictions: [] })
      ]);

      logger.info('Detection completed', {
        objectsFound: prediction.predictions?.length,
        referenceFound: reference_prediction.predictions?.length > 0
      });

      // Use manual reference if available, otherwise find from predictions
      const reference_object = photo.manualReference || 
        (reference_prediction.predictions?.find(
          (obj: any) => obj.object === "rubiks_cube"
        ));

      // If no reference object found, show manual bounding box
      if (!reference_object) {
        logger.warn('No reference object detected');
        setPictureStatus("No reference object found. Please mark it manually.");
        setIsProcessing(false);
        setShowManualBoundingBox(true);
        return false;
      }

      // Validate reference object bbox
      if (
        !Array.isArray(reference_object.bbox) ||
        reference_object.bbox.length !== 4 ||
        !reference_object.bbox.every((v: any) => typeof v === 'number')
      ) {
        logger.warn('Invalid reference object bbox');
        setPictureStatus("Invalid reference object. Please mark it manually.");
        setIsProcessing(false);
        setShowManualBoundingBox(true);
        return false;
      }

      try {
        logger.info('Refining reference bbox');
        const reference_bbox_refine = await bboxRefinementMutation.mutateAsync({
          bbox: reference_object.bbox,
          image_s3_uri: `s3://weighlty/${res1.Key}`,
        } as const);

        const pinePredictions = prediction.predictions.filter(
          (prediction) => prediction.object === "pine"
        ) || [];

        const pineThreasholdPredictions = pinePredictions.filter(
          (prediction) => prediction.confidence >= confidenceThreshold
        ) || [];

        const box = bigBboxCalculator(pineThreasholdPredictions);

        const wood_plank_count = await predictCountMutation.mutateAsync({
          s3_uri: `s3://weighlty/${res1.Key}`,
          box: [box.minX, box.minY, box.maxX, box.maxY]
        });

        const parsedPredictions = [...pineThreasholdPredictions, 
          {bbox: [box.minX, box.minY, box.maxX, box.maxY], object: "pine", confidence: 1.0}
        ];

        setPictureStatus("Analyzing objects...");
        setStatusProgress(3);
        logger.info('Calculating sizes with reference object');

        const predictions_with_size = await referenceCalculatorMutation.mutateAsync({
          predictions: parsedPredictions,
          reference_width_cm: 5.8,
          reference_width_px: reference_object.bbox[2] - reference_object.bbox[0],
          focal_length_px: 10,
          reference_height_px: reference_object.bbox[3] - reference_object.bbox[1],
        });

        setPictureStatus("Generating annotated image...");
        setStatusProgress(4);

        const pred1 = await outputImageMutation.mutateAsync({
          user: userId,
          image_s3_uri: `s3://weighlty/${res1.Key}`,
          predictions: [
            ...Array.from(predictions_with_size, x => ({ ...x })),
            {
              ...reference_object,
              bbox: (reference_bbox_refine as any).refined_bbox || reference_object.bbox
            }
          ],
        });

        if (pred1.annotated_s3_uri) {
          logger.info('Processing completed successfully');
          const download_annotated_s3 = await getFile(
            pred1.annotated_s3_uri.split('/').splice(3).join('/')
          );

          const updatedPhotos = [...capturedPhotos];
          updatedPhotos[currentPhotoIndex] = {
            photo: photo.photo,
            processed: true,
            annotatedImage: {
              image_s3_uri: `s3://weighlty/${res1.Key}`,
              annotated_s3_uri: pred1.annotated_s3_uri,
              download_annotated_s3_uri: download_annotated_s3?.url,
              predictions: [
                ...Array.from(predictions_with_size, x => ({ ...x })),
                reference_object
              ],
              wood_plank_count: wood_plank_count.yolo_count,
            },
          };

          setCapturedPhotos(updatedPhotos);
          onProcessingComplete(updatedPhotos);
          setIsProcessing(false);
          return true;
        }
      } catch (error) {
        console.error('Error in reference calculation', error);
        // logger.error('Error in reference calculation', error);
        throw error;
      }
    } catch (error) {
      logger.error('Error processing photo', error);
      setPictureStatus("Error processing image");
      setIsProcessing(false);
      return false;
    }
  }, [
    userId,
    currentPhotoIndex,
    capturedPhotos,
    splits,
    predictMutation,
    outputImageMutation,
    referenceCalculatorMutation,
    bboxRefinementMutation,
    setPictureStatus,
    setIsProcessing,
    setShowManualBoundingBox,
    setCapturedPhotos,
    onProcessingComplete,
    router
  ]);

  return {
    processPhoto
  };
} 