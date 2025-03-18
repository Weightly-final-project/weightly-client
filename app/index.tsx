import React, { useEffect } from 'react';
import { CameraView, CameraType, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import { useRef, useState } from 'react';
// import { useCameraDevice, useCameraPermission, Camera, PhotoFile } from 'react-native-vision-camera';
import { Button, GestureResponderEvent, Image, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View, Dimensions } from 'react-native';
// import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
// import { Subscription } from 'expo-sensors/src/DeviceSensor';
import { Icon } from 'react-native-elements';

import { uploadFile, getFile } from './s3';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

type FormDataSend = {
  "image_s3_uri"?: string,
  "user"?: string
  "prediction"?: []
};

const endpointMap: { [key: string]: string } = {
  "predict": "https://kg6d74p2xcfjejhqfucddvfjye0ktpzr.lambda-url.eu-west-1.on.aws/",
  "output_image": "https://wexmozjmbvb2knoqpkltzazu3y0nlixp.lambda-url.eu-west-1.on.aws/",
  "dynmo_create": "https://s6oeijufprvfccw3duv7xunfv40iydre.lambda-url.eu-west-1.on.aws/"
};
export default function App() {
  // const [facing, setFacing] = useState<CameraType>('back');
  const [pictureStatus, setPictureStatus] = useState<String>('Picture taken!');
  // const [PictureData1, setPictureData1] = useState<PhotoFile | undefined>(undefined);
  // const [PictureData2, setPictureData2] = useState<PhotoFile | undefined>(undefined);
  // const {hasPermission, requestPermission} = useCameraPermission();
  const [PictureData1, setPictureData1] = useState<CameraCapturedPicture | undefined>(undefined);
  const [PictureData2, setPictureData2] = useState<CameraCapturedPicture | undefined>(undefined);
  const [permission, requestPermissions] = useCameraPermissions();
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
  // const device = useCameraDevice('back');
  // const cameraRef = useRef<Camera>(null);
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

  // if(!device){
  //   return (
  //     <View style={styles.container}>
  //       <Text style={styles.message}>Camera not found</Text>
  //     </View>
  //   );
  // }
  if (!permission)
    return <View></View>

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermissions} title="grant permission" />
      </View>
    );
  }

  // if (!hasPermission) {
  //   // Camera permissions are not granted yet.
  //   return (
  //     <View style={styles.container}>
  //       <Text style={styles.message}>We need your permission to show the camera</Text>
  //       <Button onPress={requestPermission} title="grant permission" />
  //     </View>
  //   );
  // }

  const convertScreenToImageCoords = (
    screenX: number,
    screenY: number,
    screenWidth: number,
    screenHeight: number,
    imageWidth: number,
    imageHeight: number
  ): { x: number; y: number } => {

    const imageAspectRatio = imageWidth / imageHeight;
    const imageHeightRatio = screenHeight / 2.5;

    const scaledImageWidth = Math.min(imageAspectRatio * imageHeightRatio, screenWidth);
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
      let formData1: FormDataSend = {
        "user": "test user"
      };
      let formData2: FormDataSend = {
        "user": "test user"
      };
      try {
        const res1 = await uploadFile(PictureData1.uri, 'image1.jpg');
        const res2 = await uploadFile(PictureData2.uri, 'image2.jpg');
        formData1 = {
          ...formData1,
          "image_s3_uri": `s3://weighlty/${res1.Key}`
        }
        formData2 = {
          ...formData2,
          "image_s3_uri": `s3://weighlty/${res2.Key}`
        }
        console.log(res1, res2);
        setPictureStatus('Pictures sent!');
      } catch (e) {
        console.error(e);
        return;
      }
      // this run ok only the ide think its an error
      // formData1.append('file', {
      //   uri: PictureData1.uri,
      //   name: 'image1.jpg',
      //   type: 'image/jpeg',
      // });
      // formData2.append('file', {
      //   uri: PictureData2.uri,
      //   name: 'image2.jpg',
      //   type: 'image/jpeg',
      // });
      // const points1_normalized = points1.map(point => convertScreenToImageCoords(point.x, point.y, windowWidth, windowHeight, PictureData1.width, PictureData1.height));
      // const points2_normalized = points2.map(point => convertScreenToImageCoords(point.x, point.y, windowWidth, windowHeight, PictureData2.width, PictureData2.height));
      // formData.append('points1', JSON.stringify(points1_normalized));
      // formData.append('points2', JSON.stringify(points2_normalized));
      const sendFile = async (formData: FormDataSend, endPoint: string) => {
        console.log(formData);
        try {
          const response = await fetch(endpointMap[endPoint], {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData),
          });
          const result = await response.json();
          console.log(result);
          return result;
        } catch (error) {
          console.error('Error sending the request:', error);
        }
      };

      // const { reference_detected: reference_detected1 } = await sendFile(formData1, '/check_reference');
      // const { reference_detected: reference_detected2 } = await sendFile(formData2, '/check_reference');
      // if(reference_detected1 && reference_detected2){
      const prediction1 = await sendFile(formData1, "predict");
      const prediction2 = await sendFile(formData2, "predict");

      await sendFile(prediction1, "output_image");
      await sendFile(prediction2, "output_image");


      // download from s3 base64 image
      const annotated_image1 = await getFile('annotated_image1.jpg', 'weighlty');
      const annotated_image2 = await getFile('annotated_image2.jpg', 'weighlty');

      console.log(annotated_image1, annotated_image2);
      setPictureData1({ width: PictureData1.width, height: PictureData1.height, uri: annotated_image1?.url });
      setPictureData2({ width: PictureData2.width, height: PictureData2.height, uri: annotated_image2?.url });
      setPictureStatus('Pictures sent!');
      // }
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
      // const photo = await cameraRef.current.takePhoto();
      const photo = await cameraRef.current.takePictureAsync({ exif: true });
      console.log(photo);
      if (photo?.exif?.Orientation === 6) {
        const temp = photo.width;
        photo.width = photo.height;
        photo.height = temp;
      }
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
      <CameraView style={styles.camera} ref={cameraRef} ratio='16:9'>
        {/* <Camera style={styles.camera} ref={cameraRef} photo={true} isActive={true} device={device}> */}
        <View style={styles.buttonContainer}>
          {/* <View></View> */}
          <TouchableOpacity style={styles.button} onPress={takePicture}>
            <Icon name='circle' type='material' color='white' size={100} />
          </TouchableOpacity>
          {/* <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
            <Icon style={{ transform: [{ rotate: "90deg" }] }} name='autorenew' type='material' color='white' size={50} />
          </TouchableOpacity> */}
        </View>
        {/* </Camera> */}
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

