import { CameraCapturedPicture } from "expo-camera";
import { createContext, useContext } from "react";

const responseExample = {
  image_s3_uri: String(),
  annotated_s3_uri: String(),
  download_annotated_s3_uri: String(),
  predictions: [] as readonly any[],
};

type anototatedImageType = typeof responseExample;

interface CapturedPhoto {
  photo: CameraCapturedPicture;
  annotatedImage: anototatedImageType;
}

interface PhotoGroup {
  type: 'top-down' | 'horizontal';
  photos: CapturedPhoto[];
}

export const UserContext = createContext({
  capturedPhotoGroups: [] as PhotoGroup[],
});

export const UserContextProvider = UserContext.Provider;

export const useUser = () => useContext(UserContext);