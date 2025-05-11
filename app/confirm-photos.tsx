import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../utils/AuthContext';
import { Buffer } from 'buffer';

const { width, height } = Dimensions.get('window');

export default function ConfirmPhotosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [photos, setPhotos] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        if (params.photos) {
          const decodedPhotos = JSON.parse(Buffer.from(params.photos as string, 'base64').toString());
          setPhotos(decodedPhotos);
        }
        if (params.predictions) {
          const decodedPredictions = JSON.parse(params.predictions as string);
          setPredictions(decodedPredictions);
        }
      } catch (error) {
        console.error('Error loading photos:', error);
        Alert.alert('Error', 'Failed to load photos. Please try again.');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [params.photos, params.predictions, router]);

  const handleConfirm = () => {
    // Get the last photo to use its annotated image
    const lastPhoto = photos[photos.length - 1];

    // Create a proper item object with all required fields
    const item = {
      prediction_id: `temp_prediction_${Date.now()}`,
      user: user?.username || "guest",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      image_s3_uri: lastPhoto?.annotatedImage?.image_s3_uri || "",
      annotated_s3_uri: lastPhoto?.annotatedImage?.annotated_s3_uri || "",
      download_image_s3_uri: lastPhoto?.photo?.uri || "",
      photos: photos.map(p => ({
        image_s3_uri: p.annotatedImage?.image_s3_uri || "",
        annotated_s3_uri: p.annotatedImage?.annotated_s3_uri || "",
        download_annotated_s3_uri:  p.annotatedImage?.download_annotated_s3_uri || "",
      })),
    };

    router.replace({
      pathname: "/prediction",
      params: {
        item: Buffer.from(JSON.stringify(item)).toString("base64"),
        predictions: params.predictions,
      },
    });
  };

  const handleRetake = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Confirm Photos" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Loading photos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Confirm Photos" showBack={true} />
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Review Your Photos</Text>
        <Text style={styles.subtitle}>Make sure both photos are clear and show the object properly</Text>
        
        <View style={styles.photosContainer}>
          {photos.map((photo: any, index: number) => (
            <View key={index} style={styles.photoCard}>
              <Text style={styles.photoLabel}>
                {index === 0 ? 'Top-Down View' : 'Horizontal View'}
              </Text>
              <Image
                source={{ uri: photo.annotatedImage?.download_annotated_s3_uri || photo.photo.uri }}
                style={styles.photoImage}
                resizeMode="contain"
              />
              {photo.annotatedImage && (
                <View style={styles.detectedBadge}>
                  <Text style={styles.detectedText}>✓ Object Detected</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.retakeButton]}
            onPress={handleRetake}
          >
            <Text style={[styles.buttonText, styles.retakeButtonText]}>Retake Photos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.confirmButton]}
            onPress={handleConfirm}
          >
            <Text style={styles.buttonText}>Continue to Results</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 24,
    textAlign: 'center',
  },
  photosContainer: {
    gap: 16,
  },
  photoCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  photoLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 12,
    backgroundColor: '#2A2A2A',
  },
  photoImage: {
    width: '100%',
    height: height * 0.3,
    backgroundColor: '#000',
  },
  detectedBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  detectedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  confirmButton: {
    backgroundColor: '#6200ee',
  },
  retakeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6200ee',
  },
  retakeButtonText: {
    color: '#6200ee',
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