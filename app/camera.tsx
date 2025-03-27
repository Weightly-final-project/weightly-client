import React from 'react';
import { CameraView, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import { useRef, useState } from 'react';
import { Button, GestureResponderEvent, Image, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Icon } from 'react-native-elements';

import { uploadFile, getFile } from '../utils/s3';
import { hooks } from '../utils/api';
import ImagePickerExample from '../components/pickImage';
import styles from '../utils/style';
import Permission from '../components/Permission';

// Use your API hooks
const { 
  usePredictMutation, 
  useOutput_imageMutation, 
  useDynmo_createMutation, 
  useReference_calculatorMutation 
} = hooks;

const responseExample = {
  image_s3_uri: String(),
  annotated_s3_uri: String(), 
  predictions: [] as readonly any[]
}

type anototatedImageType = typeof responseExample;

export default function CameraScreen() {
  const [pictureStatus, setPictureStatus] = useState<String>('Picture taken!');
  const [PictureData1, setPictureData1] = useState<CameraCapturedPicture | undefined>(undefined);
  const [PictureData2, setPictureData2] = useState<CameraCapturedPicture | undefined>(undefined);
  const [anototatedImage1, setAnnotatedImage1] = useState<anototatedImageType>(responseExample);
  const [anototatedImage2, setAnnotatedImage2] = useState<anototatedImageType>(responseExample);
  const [moveToSecondPicture, setMoveToSecondPicture] = useState<boolean>(false);
  const [points1, setPoints1] = useState<{ x: number; y: number }[]>([]);
  const [points2, setPoints2] = useState<{ x: number; y: number }[]>([]);

  const [permission, requestPermissions] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);

  const finishFlag = PictureData1 && PictureData2;

  // Replace your sendFile function with hooks
  const predictMutation = usePredictMutation();
  const outputImageMutation = useOutput_imageMutation();
  const dynamoCreateMutation = useDynmo_createMutation();
  const referenceCalculatorMutation = useReference_calculatorMutation();

  if (!permission || !permission.granted) {
    return (
      <Permission permissionType={"camera"} requestPermissions={requestPermissions} />
    );
  }

  const sendPicture = async (uri: string) => {
    try {
      const res1 = await uploadFile(uri, `original_images/test-user_${Date.now()}_image1.jpg`);

      const formData1 = {
        "user": "test user",
        "image_s3_uri": `s3://weighlty/${res1.Key}`,
        "model_s3_uri": "s3://weighlty/pine.pt",
      } as const;

      const formData2 = {
        "user": "test user",
        "image_s3_uri": `s3://weighlty/${res1.Key}`,
        "model_s3_uri": "s3://rbuixcube/large_files/best.pt",
      } as const;

      setPictureStatus('Pictures sent!');

      // Use your hooks instead of sendFile
      const prediction = await predictMutation.mutateAsync(formData1);
      const reference_prediction = await predictMutation.mutateAsync(formData2);

      const reference_object = reference_prediction.predictions?.find((obj: any) => obj.object === 'rubiks_cube');

      console.log('reference_prediction', reference_prediction);
      console.log('prediction', prediction);
      console.log('reference_object', reference_object);

      setPictureStatus('Pictures predicted!');

      if (prediction.predictions && reference_prediction.predictions && reference_prediction.predictions.length > 0) {
        const predictions_with_size = await referenceCalculatorMutation.mutateAsync({
          predictions: prediction.predictions,
          reference_width_cm: 10,
          reference_width_px: reference_object?.bbox[2] - reference_object?.bbox[0],
          focal_length_px: 400,
        });
        console.log('predictions_with_size', predictions_with_size);
        setPictureStatus('Pictures calculated size!');

        const pred1 = await outputImageMutation.mutateAsync({
          user : "test user",
          image_s3_uri : `s3://weighlty/${res1.Key}`,
          predictions: predictions_with_size,
        });

        setPictureStatus('Pictures annotated!');

        if (pred1.annotated_s3_uri) {
          if (moveToSecondPicture)
            setAnnotatedImage2({
              image_s3_uri: `s3://weighlty/${res1.Key}`,
              annotated_s3_uri: pred1.annotated_s3_uri,
              predictions: predictions_with_size
            });
          else
            setAnnotatedImage1({
              image_s3_uri: `s3://weighlty/${res1.Key}`,
              annotated_s3_uri: pred1.annotated_s3_uri,
              predictions: predictions_with_size
            });

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
        <Text style={styles.message}>{pictureStatus}</Text>
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
            <Image source={{ uri: PictureData1.uri }} style={styles.image} />
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
              <Image source={{ uri: PictureData2.uri }} style={styles.image} />
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
          console.log(PictureData1, PictureData2);
          dynamoCreateMutation.mutateAsync({
            ...anototatedImage1,
            user: "test user",
          });
          dynamoCreateMutation.mutateAsync({
            ...anototatedImage2,
            user: "test user",
          });
        }} title="Save Result" />
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ exif: true });
      processImage(photo);
    }
  };

  const processImage = (photo: CameraCapturedPicture | undefined) => {
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
        <ImagePickerExample {...{processImage}} />
      </CameraView>
    </View>
  );
}

