import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppHeader from '../components/AppHeader';
import { Buffer } from 'buffer';
import { ManualBoundingBox } from '../components/ManualBoundingBox';
import { useAuth } from '../utils/AuthContext';
import { getFile, uploadFile } from '../utils/s3';
import { hooks } from '../utils/api';

const { useOutput_imageMutation } = hooks;

const { width, height } = Dimensions.get('window');

export default function EditPhotoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [photos, setPhotos] = useState<any[]>([]);
  const [photoIndex, setPhotoIndex] = useState<number>(0);
  const [currentEditMode, setCurrentEditMode] = useState<'wood' | 'cube' | null>(null);
  const [woodBBox, setWoodBBox] = useState<any>(null);
  const [cubeBBox, setCubeBBox] = useState<any>(null);
  const outputImageMutation = useOutput_imageMutation();

  useEffect(() => {
    const loadData = async () => {
      try {
        if (params.photos) {
          const decodedPhotos = JSON.parse(Buffer.from(params.photos as string, 'base64').toString());
          setPhotos(decodedPhotos);
        }
        if (params.photoIndex) {
          const index = parseInt(params.photoIndex as string);
          setPhotoIndex(index);
          
          // Load existing bounding boxes if available
          const photo = photos[index];
          if (photo?.annotatedImage?.predictions) {
            const woodPred = photo.annotatedImage.predictions.find((p: any) => p.object === "pine");
            const cubePred = photo.annotatedImage.predictions.find((p: any) => p.object === "rubiks_cube");
            
            if (woodPred?.bbox) {
              setWoodBBox({
                minX: woodPred.bbox[0] / 1000,
                minY: woodPred.bbox[1] / 1000,
                maxX: woodPred.bbox[2] / 1000,
                maxY: woodPred.bbox[3] / 1000,
              });
            }
            
            if (cubePred?.bbox) {
              setCubeBBox({
                minX: cubePred.bbox[0] / 1000,
                minY: cubePred.bbox[1] / 1000,
                maxX: cubePred.bbox[2] / 1000,
                maxY: cubePred.bbox[3] / 1000,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading photos:', error);
        Alert.alert('Error', 'Failed to load photo. Please try again.');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [params.photos, params.photoIndex, router]);

  const handleBoundingBoxSelected = async (bbox: { minX: number, minY: number, maxX: number, maxY: number }) => {
    if (currentEditMode === 'wood') {
      setWoodBBox(bbox);
    } else if (currentEditMode === 'cube') {
      setCubeBBox(bbox);
    }
    setCurrentEditMode(null);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const currentPhoto = photos[photoIndex];
      if (!currentPhoto || !woodBBox || !cubeBBox) return;

      const res1 = await uploadFile(
        currentPhoto.photo.uri,
        `original_images/${user?.username || "guest"}_${Date.now()}_image${photoIndex + 1}.jpg`
      );

      const predictions = [
        {
          bbox: [woodBBox.minX * 1000, woodBBox.minY * 1000, woodBBox.maxX * 1000, woodBBox.maxY * 1000],
          object: "pine",
          confidence: 0.99,
          size_cm: [30, 30, 30],
        },
        {
          bbox: [cubeBBox.minX * 1000, cubeBBox.minY * 1000, cubeBBox.maxX * 1000, cubeBBox.maxY * 1000],
          object: "rubiks_cube",
          confidence: 0.99,
        }
      ];

      const pred1 = await outputImageMutation.mutateAsync({
        user: user?.username || "guest",
        image_s3_uri: `s3://weighlty/${res1.Key}`,
        predictions,
      });

      if (pred1.annotated_s3_uri) {
        const updatedPhotos = [...photos];
        const download_annotated_s3 = await getFile(
          pred1.annotated_s3_uri.split('/').splice(3).join('/')
        );
        updatedPhotos[photoIndex] = {
          ...currentPhoto,
          processed: true,
          annotatedImage: {
            image_s3_uri: `s3://weighlty/${res1.Key}`,
            annotated_s3_uri: pred1.annotated_s3_uri,
            download_annotated_s3_uri: download_annotated_s3?.url,
            predictions,
          },
        };

        router.replace({
          pathname: "/confirm-photos",
          params: {
            photos: Buffer.from(JSON.stringify(updatedPhotos)).toString("base64"),
            predictions: params.predictions,
          },
        });
      }
    } catch (error) {
      console.error('Error saving edits:', error);
      Alert.alert('Error', 'Failed to save edits. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Edit Photo" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Loading photo...</Text>
        </View>
      </View>
    );
  }

  const currentPhoto = photos[photoIndex];
  if (!currentPhoto) return null;

  return (
    <View style={styles.container}>
      <AppHeader title="Edit Photo" showBack={true} />
      <View style={styles.content}>
        <Image
          source={{ uri: currentPhoto.annotatedImage?.download_annotated_s3_uri || currentPhoto.photo.uri }}
          style={styles.photoImage}
          resizeMode="contain"
        />
        
        <View style={styles.editControls}>
          <TouchableOpacity
            style={[styles.editButton, woodBBox && styles.editButtonComplete]}
            onPress={() => setCurrentEditMode('wood')}
          >
            <Text style={styles.editButtonText}>
              {woodBBox ? '✓ Edit Wood Stack' : 'Select Wood Stack'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.editButton, cubeBBox && styles.editButtonComplete]}
            onPress={() => setCurrentEditMode('cube')}
          >
            <Text style={styles.editButtonText}>
              {cubeBBox ? '✓ Edit Rubiks Cube' : 'Select Rubiks Cube'}
            </Text>
          </TouchableOpacity>
          
          {woodBBox && cubeBBox && (
            <TouchableOpacity
              style={[styles.editButton, styles.saveButton]}
              onPress={handleSave}
            >
              <Text style={styles.editButtonText}>Save Changes</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {currentEditMode && (
        <View style={StyleSheet.absoluteFill}>
          <ManualBoundingBox
            imageUri={currentPhoto.photo.uri}
            onBoundingBoxSelected={handleBoundingBoxSelected}
            onCancel={() => setCurrentEditMode(null)}
            initialBBox={currentEditMode === 'wood' ? woodBBox : cubeBBox}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  photoImage: {
    width: '100%',
    height: height * 0.6,
    backgroundColor: '#000',
    borderRadius: 12,
    marginBottom: 16,
  },
  editControls: {
    gap: 12,
  },
  editButton: {
    backgroundColor: '#1E1E1E',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonComplete: {
    backgroundColor: '#1976D2',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    marginTop: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
}); 