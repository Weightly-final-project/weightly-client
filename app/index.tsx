import React from 'react';
import { CameraView, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import { useRef, useState } from 'react';
// import { useCameraDevice, useCameraPermission, Camera, PhotoFile } from 'react-native-vision-camera';
import { Button, GestureResponderEvent, Image, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View, Dimensions } from 'react-native';
// import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
// import { Subscription } from 'expo-sensors/src/DeviceSensor';
import { Icon } from 'react-native-elements';

import { uploadFile, getFile } from '../utils/s3';
import { hooks } from '../utils/api'; // Use your new API hooks

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

// Use your API hooks
const { usePredictMutation, useOutput_imageMutation, useDynmo_createMutation } = hooks;

export default function HomeScreen() {
  const [pictureStatus, setPictureStatus] = useState<String>('Picture taken!');
  const [PictureData1, setPictureData1] = useState<CameraCapturedPicture | undefined>(undefined);
  const [PictureData2, setPictureData2] = useState<CameraCapturedPicture | undefined>(undefined);
  const [permission, requestPermissions] = useCameraPermissions();
  const [moveToSecondPicture, setMoveToSecondPicture] = useState<boolean>(false);
  const [points1, setPoints1] = useState<{ x: number; y: number }[]>([]);
  const [points2, setPoints2] = useState<{ x: number; y: number }[]>([]);
  const [prediction1, setPrediction1] = useState<any[]>([]);
  const [prediction2, setPrediction2] = useState<any[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const image1Ref = useRef<Image>(null);
  const image2Ref = useRef<Image>(null);
  const finishFlag = PictureData1 && PictureData2;

  // Replace your sendFile function with hooks
  const predictMutation = usePredictMutation();
  const outputImageMutation = useOutput_imageMutation();
  const dynamoCreateMutation = useDynmo_createMutation();

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

  const sendPicture = async (uri: string) => {
    try {
      const res1 = await uploadFile(uri, `original_images/test-user_${Date.now()}_image1.jpg`);

      const formData1 = {
        "user": "test user",
        "image_s3_uri": `s3://weighlty/${res1.Key}`
      } as const;

      setPictureStatus('Pictures sent!');

      // Use your hooks instead of sendFile
      const prediction = await predictMutation.mutateAsync(formData1);

      setPictureStatus('Pictures predicted!');

      if (prediction.predictions) {
        if (moveToSecondPicture)
          setPrediction2(prediction.predictions);
        else
          setPrediction1(prediction.predictions);

        const pred1 = await outputImageMutation.mutateAsync(prediction);

        setPictureStatus('Pictures annotated!');

        if (pred1.annotated_s3_uri) {
          // download from s3 base64 image
          const annotated_image1 = await getFile(pred1.annotated_s3_uri.split('/').splice(3).join('/'), 'weighlty');
          setPictureStatus('Pictures recived!');
          return annotated_image1?.url;
        }
      }
    } catch (e) {
      console.error(e);
      return;
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
        {outputImageMutation.isLoading || predictMutation.isLoading ?
          <Text style={styles.message}>Loading...</Text>
          :
          <Image source={{ uri: PictureData1.uri }} style={styles.image} />
        }
        <Button disabled={outputImageMutation.isLoading || predictMutation.isLoading} onPress={() => setMoveToSecondPicture(true)} title="Take another picture" />
        <Button disabled={outputImageMutation.isLoading || predictMutation.isLoading} onPress={() => setPictureData1(undefined)} title="Retake the picture" />
      </View>
    );
  }

  if (finishFlag) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{pictureStatus}</Text>
        <TouchableWithoutFeedback disabled={outputImageMutation.isLoading || predictMutation.isLoading} onPress={(e) => handlePress(e, setPoints1, points1)}>
          <View>
            <Image ref={image1Ref} source={{ uri: PictureData1.uri }} style={styles.image} />
            {points1.map((point, i) => (
              <View key={i} style={[styles.pointMarker, { top: point.y, left: point.x }]} />
            ))}
          </View>
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback disabled={outputImageMutation.isLoading || predictMutation.isLoading} onPress={(e) => handlePress(e, setPoints2, points2)}>
          <View>
            {outputImageMutation.isLoading || predictMutation.isLoading ?
              <Text style={styles.message}>Loading...</Text>
              :
              <Image ref={image2Ref} source={{ uri: PictureData2.uri }} style={styles.image} />
            }
            {points2.map((point, i) => (
              <View key={i} style={[styles.pointMarker, { top: point.y, left: point.x }]} />
            ))}
          </View>
        </TouchableWithoutFeedback>
        {/* <Button onPress={() => sendPicture()} title="Send Picture" /> */}
        <Button disabled={outputImageMutation.isLoading || predictMutation.isLoading} onPress={() => {
          setPictureData2(undefined);
          setPoints2([]);
        }} title="Retake the picture" />
        <Button disabled={outputImageMutation.isLoading || predictMutation.isLoading} onPress={() => {
          setPoints2([]);
          setPoints1([]);
        }} title="Reset Points" />
        <Button disabled={predictMutation.isLoading || outputImageMutation.isLoading || dynamoCreateMutation.isLoading} onPress={() => {
          dynamoCreateMutation.mutateAsync({
            user: "test user",
            image_s3_uri: "s3://weighlty/image1.jpg",
            predictions: prediction1,
            annotated_s3_uri: "s3://weighlty/annotated_image1.jpg"
          });
          dynamoCreateMutation.mutateAsync({
            user: "test user",
            image_s3_uri: "s3://weighlty/image2.jpg",
            predictions: prediction2,
            annotated_s3_uri: "s3://weighlty/annotated_image2.jpg"
          });
        }} title="Save Result" />
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ exif: true });
      if (photo?.exif?.Orientation === 6) {
        const temp = photo.width;
        photo.width = photo.height;
        photo.height = temp;
      }
      const { width, height, uri } = photo || { width: 0, height: 0, uri: '' };

      if (moveToSecondPicture)
        setPictureData2({ width, height, uri });
      else
        setPictureData1({ width, height, uri });

      sendPicture(uri).then((annotated_photo) => {
        if (moveToSecondPicture)
          setPictureData2({ width, height, uri: (annotated_photo || uri) });
        else
          setPictureData1({ width, height, uri: (annotated_photo || uri) });
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text>
        Take a picture of the object from the {moveToSecondPicture ? "sides\n" : "front or back\n"}
      </Text>
      <CameraView style={styles.camera} ref={cameraRef} ratio='16:9'>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={takePicture}>
            <Icon name='circle' type='material' color='white' size={100} />
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
    alignSelf: 'center',
    width: windowWidth,
    height: windowHeight - 70,
  },
  image: {
    margin: 5,
    width: windowWidth,
    height: windowHeight / 2.7,
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

