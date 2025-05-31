import { CameraCapturedPicture } from 'expo-camera';

export type PhotoMode = 'front' | 'side';

export interface ReferenceObject {
  object: string;
  confidence: number;
  bbox: number[];
}

export interface AnnotatedImage {
    image_s3_uri: string;
    annotated_s3_uri: string;
    download_annotated_s3_uri?: string;
    predictions: any[];
}

export interface CapturedPhoto {
  photo: CameraCapturedPicture;
  processed?: boolean;
  manualReference?: ReferenceObject;
  annotatedImage?: AnnotatedImage;
}

export interface PhotoToProcess {
  photo: CameraCapturedPicture | undefined;
  processed?: boolean;
  manualReference?: ReferenceObject;
  annotatedImage?: {
    image_s3_uri: string;
    annotated_s3_uri: string;
    predictions: any[];
  };
}

export interface Split {
  x_splits: number;
  y_splits: number;
  confidenceThreshold: number;
}

export const defaultSplitsConfig: Record<PhotoMode, Split> = {
  front: {
    x_splits: 2,
    y_splits: 2,
    confidenceThreshold: 0.5,
  },
  side: {
    x_splits: 2,
    y_splits: 2,
    confidenceThreshold: 0.5,
  },
}; 