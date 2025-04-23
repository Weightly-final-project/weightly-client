import { Button, View, StyleSheet } from 'react-native';
import {launchImageLibraryAsync} from 'expo-image-picker';
import { CameraCapturedPicture } from 'expo-camera';

export default function ImagePickerExample(props: {
    processImage: (photo: CameraCapturedPicture | undefined) => void;
}) {

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
      exif: true,
    });

    const photo = result.assets?.at(0) as CameraCapturedPicture | undefined;

    if (photo)
      props.processImage(photo);

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
    alignItems: 'center',
    justifyContent: 'center',
  }
});
