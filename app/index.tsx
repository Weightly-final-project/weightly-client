import React, { useEffect } from 'react';
import { CameraView, CameraType, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import { useRef, useState } from 'react';
import { Button, GestureResponderEvent, Image, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View, Dimensions } from 'react-native';
// import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
// import { Subscription } from 'expo-sensors/src/DeviceSensor';
import { Icon } from 'react-native-elements';


const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

export default function App() {
  // const [facing, setFacing] = useState<CameraType>('back');
  const [pictureStatus, setPictureStatus] = useState<String>('Picture taken!');
  const [PictureData1, setPictureData1] = useState<CameraCapturedPicture | undefined>(undefined);
  const [PictureData2, setPictureData2] = useState<CameraCapturedPicture | undefined>(undefined);
  const [permission, requestPermission] = useCameraPermissions();
  const [moveToSecondPicture, setMoveToSecondPicture] = useState<boolean>(false);
  const [points1, setPoints1] = useState<{ x: number; y: number }[]>([]);
  const [points2, setPoints2] = useState<{ x: number; y: number }[]>([]);
  // const [subscription, setSubscription] = useState<Subscription | undefined>(undefined);
  // const [distence, setDistence] = useState<AccelerometerMeasurement>({
  //   x: 0,
  //   y: 0,
  //   z: 0,
  //   timestamp: 0,
  // });
  // let currData = {
  //   x: 0,
  //   y: 0,
  //   z: 0,
  //   timestamp: 0,
  // } as AccelerometerMeasurement;
  const cameraRef = useRef<CameraView>(null);
  const image1Ref = useRef<Image>(null);
  const image2Ref = useRef<Image>(null);
  const finishFlag = PictureData1 && PictureData2;
  // const _subscribe = () => {
  //   setSubscription(
  //     Accelerometer.addListener(AccelerometerData => {
  //       console.log(AccelerometerData);
  //       const AccelerometerDataParsed = {
  //         x: AccelerometerData.x > 0.3 ? AccelerometerData.x : 0,
  //         y: AccelerometerData.y > 0.3 ? AccelerometerData.y : 0,
  //         z: AccelerometerData.z > 0.3 ? AccelerometerData.z : 0,
  //         timestamp: AccelerometerData.timestamp,
  //       }
  //       // console.log(AccelerometerDataParsed, currData);
  //       setDistence({
  //         x: (AccelerometerDataParsed.x - currData.x)*9.81*(0.2**2)/2 + distence.x,
  //         y: (AccelerometerDataParsed.y - currData.y)*9.81*(0.2**2)/2 + distence.y,
  //         z: (AccelerometerDataParsed.z - currData.z)*9.81*(0.2**2)/2 + distence.z,
  //         timestamp: AccelerometerDataParsed.timestamp,
  //       });
  //       currData = AccelerometerDataParsed;
  //     })
  //   );
  // };

  // const _unsubscribe = () => {
  //   subscription && subscription.remove();
  //   setSubscription(undefined);
  // };
  // useEffect(() => {
  //   _subscribe();
  //   return () => _unsubscribe();
  // }, []);

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

const convertScreenToImageCoords = (
  screenX: number,
  screenY: number,
  screenWidth: number,
  screenHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } => {

  const imageAspectRatio = imageWidth / imageHeight;
  const imageHeightRatio = screenHeight/2.5;

  const scaledImageWidth = Math.min(imageAspectRatio*imageHeightRatio, screenWidth);
  const scaledImageHeight = scaledImageWidth / imageAspectRatio;
  const offsetX = (screenWidth - scaledImageWidth) / 2;
  const offsetY = (imageHeightRatio - scaledImageHeight) / 2;

  // Clamp the screen coordinates to the image display area
  const clampedScreenX = Math.max(offsetX, Math.min(screenX, offsetX + scaledImageWidth));
  const clampedScreenY = Math.max(offsetY, Math.min(screenY, offsetY + scaledImageHeight));

  // Convert clamped coordinates
  const x = Math.round((clampedScreenX - offsetX) * (imageWidth / scaledImageWidth));
  const y = Math.round((clampedScreenY - offsetY) * (imageHeight / scaledImageHeight));

  return { x, y };
};
  
  const sendPicture = async () => {
    if (finishFlag) {
      const formData = new FormData();
      // this run ok only the ide think its an error
      formData.append('image1', {
        uri: PictureData1.uri,
        name: 'image1.jpg',
        type: 'image/jpeg',
      });
      formData.append('image2', {
        uri: PictureData2.uri,
        name: 'image2.jpg',
        type: 'image/jpeg',
      });

      const points1_normalized = points1.map(point => convertScreenToImageCoords(point.x, point.y, windowWidth, windowHeight, PictureData1.width, PictureData1.height));
      const points2_normalized = points2.map(point => convertScreenToImageCoords(point.x, point.y, windowWidth, windowHeight, PictureData2.width, PictureData2.height));
      formData.append('points1', JSON.stringify(points1_normalized));
      formData.append('points2', JSON.stringify(points2_normalized));

      try {
        const response = await fetch('http://30.30.11.97:8000/predict', {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });

        const result = await response.json();
        console.log(result);
        setPictureData1({ width: PictureData1.width, height: PictureData1.height, uri: `data:image/png;base64,${result.image1}` });
        setPictureData2({ width: PictureData2.width, height: PictureData2.height, uri: `data:image/png;base64,${result.image2}` });
        setPictureStatus('Pictures sent!');
      } catch (error) {
        console.error('Error sending the request:', error);
      }
    }
  };

  const handlePress = (
    event: GestureResponderEvent,
    setPoints: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>,
    pointsArray: { x: number; y: number }[]
  ) => {
    if (pointsArray.length >= 4) return;
    const { locationX, locationY } = event.nativeEvent;
    setPoints([...pointsArray, { x: locationX, y: locationY }]);
  }

  if (PictureData1 && !PictureData2 && !moveToSecondPicture) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: PictureData1.uri }} style={styles.image} />
        <Button onPress={() => setMoveToSecondPicture(true)} title="Take another picture" />
        <Button onPress={() => setPictureData1(undefined)} title="Retake the picture" />
      </View>
    );
  }
  if (finishFlag) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{pictureStatus}</Text>
        <TouchableWithoutFeedback onPress={(e) => handlePress(e, setPoints1, points1)}>
          <View>
            <Image ref={image1Ref} source={{ uri: PictureData1.uri }} style={styles.image} />
            {points1.map((point, i) => (
              <View key={i} style={[styles.pointMarker, { top: point.y, left: point.x }]} />
            ))}
          </View>
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={(e) => handlePress(e, setPoints2, points2)}>
          <View>
            <Image ref={image2Ref} source={{ uri: PictureData2.uri }} style={styles.image} />
            {points2.map((point, i) => (
              <View key={i} style={[styles.pointMarker, { top: point.y, left: point.x }]} />
            ))}
          </View>
        </TouchableWithoutFeedback>
        <Button onPress={() => sendPicture()} title="Send Picture" />
        <Button onPress={() => {
          setPictureData2(undefined);
          setPoints2([]);
        }} title="Retake the picture" />
        <Button onPress={() => {
          setPoints2([]);
          setPoints1([]);
        }} title="Reset Points" />
      </View>
    );
  }


  // function toggleCameraFacing() {
  //   setFacing(current => (current === 'back' ? 'front' : 'back'));
  // }

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ exif: true });
      if(photo?.exif?.Orientation === 6) {
        const temp = photo.width;
        photo.width = photo.height;
        photo.height = temp;
      }
      console.log(photo);
      if (moveToSecondPicture)
        setPictureData2(photo);
      else
        setPictureData1(photo);
    }
  };

  return (
    <View style={styles.container}>
      <Text>
        Take a picture of the object from the {moveToSecondPicture ? "sides\n" : "front or back\n"}
        {/* x: 0.00{`\n`}y: 0.00{`\n`}z: 0.00{`\n`} */}
        {/* x: {`${(distence.x * 100).toFixed(2)}\n`}y: {`${(distence.y*100).toFixed(2)}\n`}z: {`${(distence.z*100).toFixed(2)}\n`} */}
      </Text>
      {/* <CameraView style={styles.camera} ref={cameraRef} facing={facing} ratio='16:9'> */}
      <CameraView style={styles.camera} ref={cameraRef} ratio='16:9'>
        <View style={styles.buttonContainer}>
          {/* <View></View> */}
          <TouchableOpacity style={styles.button} onPress={takePicture}>
            <Icon name='circle' type='material' color='white' size={100} />
          </TouchableOpacity>
          {/* <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
            <Icon style={{ transform: [{ rotate: "90deg" }] }} name='autorenew' type='material' color='white' size={50} />
          </TouchableOpacity> */}
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
    alignSelf: 'center',
    width: windowWidth,
    height: windowHeight - 70,
  },
  image: {
    margin: 5,
    width: windowWidth,
    height: windowHeight / 2.5,
    alignSelf: 'center',
    objectFit: 'contain',
    backgroundColor: 'black',
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
  },
  pointMarker: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'red'
  }
});

