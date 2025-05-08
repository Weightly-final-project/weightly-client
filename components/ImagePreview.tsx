import React from "react";
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import { Icon } from "react-native-elements";

interface ImagePreviewProps {
  imageUri: string;
  isProcessing: boolean;
  onRetake: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  imageUri,
  isProcessing,
  onRetake,
}) => {
  return (
    <View className="flex-1 bg-[#121212] w-full">
      <View className="flex-row items-center justify-between pt-[50px] pb-4 px-4 bg-[#202020]">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-white/10 justify-center items-center" 
          onPress={onRetake}
        >
          <Icon name="arrow-back" type="material" color="white" size={24} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Front View</Text>
        <View />
      </View>

      <View className="flex-1 justify-center items-center bg-[#202020]">
        {!isProcessing && (
          <Image 
            source={{ uri: imageUri }} 
            className="w-full h-[70%]"
            resizeMode="cover"
          />
        )}
      </View>

      <View className="flex-row justify-around p-4 bg-[#202020]">
        <TouchableOpacity
          className={`bg-[#333333] py-3 px-5 rounded-lg flex-row items-center justify-center min-w-[100px] ${
            isProcessing ? 'opacity-50' : ''
          }`}
          disabled={isProcessing}
          onPress={onRetake}
        >
          <Icon name="refresh" type="material" color="white" size={24} />
          <Text className="text-white font-bold ml-2">Retake</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ImagePreview;
