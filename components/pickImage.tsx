import { Button, View, StyleSheet } from "react-native";
import { launchImageLibraryAsync } from "expo-image-picker";
import { CameraCapturedPicture } from "expo-camera";

export default function ImagePickerExample(props: {
  processImage: (photo: CameraCapturedPicture | undefined) => void;
  updatePhotosTaken: () => void;
}) {
  const pickImage = async () => {
    try {
      let result = await launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        exif: true,
      });

      const photo = result.assets?.at(0) as CameraCapturedPicture | undefined;

      if (photo) {
        console.log("Cropped image metadata:", photo.exif);
        props.processImage(photo);
        props.updatePhotosTaken();
      }
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
