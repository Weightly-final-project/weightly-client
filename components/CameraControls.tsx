import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Icon } from "react-native-elements";
import ImagePickerExample from "./pickImage";
import { CameraCapturedPicture } from "expo-camera";

const CameraControls = ({
  onCapture,
  onPickImage,
  isProcessing,
}: {
  onCapture: () => void;
  onPickImage: (photo: CameraCapturedPicture | undefined) => void;
  isProcessing: boolean;
}) => {
  return (
    <View className="flex-row justify-around items-center py-[30px] px-[30px] w-full">
      <TouchableOpacity
        className="w-[50px] h-[50px] rounded-full bg-white/20 justify-center items-center"
        disabled={isProcessing}
      >
        <ImagePickerExample processImage={onPickImage} />
      </TouchableOpacity>

      <TouchableOpacity
        className="w-20 h-20 rounded-full bg-white/20 justify-center items-center"
        onPress={onCapture}
        disabled={isProcessing}
      >
        <Icon name="camera" type="font-awesome" color="#FFF" size={24} />
      </TouchableOpacity>

      <View className="w-[50px] h-[50px]" />
    </View>
  );
};

export default CameraControls;
