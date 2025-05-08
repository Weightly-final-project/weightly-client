import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Icon } from "react-native-elements";

const CameraHeader = ({ onBackPress }: { onBackPress: () => void }) => {
  return (
    <View className="flex-row items-center justify-between pt-[50px] pb-4 px-4 bg-black/50 absolute top-0 left-0 right-0 z-10">
      <TouchableOpacity 
        className="w-10 h-10 rounded-full bg-black/50 justify-center items-center" 
        onPress={onBackPress}
      >
        <Icon name="arrow-back" type="material" color="white" size={24} />
      </TouchableOpacity>
      <Text className="text-lg font-bold text-white">Capture or choose a picture</Text>
      <View></View>
    </View>
  );
};

export default CameraHeader;
