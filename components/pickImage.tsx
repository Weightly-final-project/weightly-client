import { Button, View, StyleSheet } from "react-native";
import { launchImageLibraryAsync } from "expo-image-picker";
import { CameraCapturedPicture } from "expo-camera";
import ImagePicker from "react-native-image-crop-picker";

export default function ImagePickerExample(props: {
  processImage: (photo: CameraCapturedPicture | undefined) => void;
}) {
  const pickImage = async () => {
    try {
      const result = await ImagePicker.openPicker({
        width: 300,
        height: 400,
        cropping: true,
        includeExif: true,
      });

      const photo = {
        uri: result.path,
        width: result.width,
        height: result.height,
        exif: result.exif,
      } as CameraCapturedPicture;

      console.log("Cropped image metadata:", photo.exif);

      if (photo) props.processImage(photo);
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Pick an image from camera roll" onPress={pickImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
