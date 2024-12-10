import { CameraView, CameraType, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import { useRef, useState } from 'react';
import { Button, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from 'react-native-elements';

export default function App() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [pictureStatus, setPictureStatus] = useState<String>('Picture taken!');
  const [PictureData, setPictureData] = useState<CameraCapturedPicture | undefined>(undefined);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const sendPicture = async () => {
    if (PictureData !== undefined) {
      const formData = new FormData();
      // this run ok only the ide think its an error
      formData.append('image', {
        uri: PictureData.uri,
        name: 'image.jpg',
        type: 'image/jpeg',
      });

      try {
        const response = await fetch('http://192.168.1.239:8000/predict', {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });
  
        const result = await response.json();
        console.log(result);
        setPictureStatus('Picture sent!');
      } catch (error) {
        console.error('Error sending the request:', error);
      }
    }
  };

  if (PictureData !== undefined) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{pictureStatus}</Text>
        <Image source={{ uri: PictureData.uri }} style={styles.camera} />
        <Button onPress={() => sendPicture()} title="Send Picture" />
        <Button onPress={() => setPictureData(undefined)} title="Take another picture" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      console.log(photo);
      setPictureData(photo);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing={facing}>
        <View style={styles.buttonContainer}>
        <View></View>
          <TouchableOpacity style={styles.button} onPress={takePicture}>
          <Icon name='circle' type='material' color='white' size={100}/>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
          <Icon style={{transform: [{ rotate: "90deg" }]}} name='autorenew' type='material' color='white' size={50}/>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    justifyContent: 'space-around',
    marginTop: 64,
    marginBottom: 64,
    marginLeft: 0,
    marginRight: 0,
  },
  button: {
    alignItems: 'center',
    flexDirection: 'row',
  }
});

