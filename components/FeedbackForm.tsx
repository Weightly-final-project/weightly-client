import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Icon } from 'react-native-elements';

const { width, height } = Dimensions.get('window');

interface FeedbackFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackData) => void;
  isSubmitting?: boolean;
}

interface FeedbackData {
  easeOfUse: number;
  visualDesign: number;
  navigation: number;
  performance: number;
  overallExperience: number;
  comments?: string;
}

const questions = [
  { key: 'easeOfUse', label: 'How easy is the app to use?', description: 'Rate the overall ease of use' },
  { key: 'visualDesign', label: 'How would you rate the visual design?', description: 'Rate the app\'s appearance and layout' },
  { key: 'navigation', label: 'How intuitive is the navigation?', description: 'Rate how easy it is to find what you need' },
  { key: 'performance', label: 'How would you rate the app\'s performance?', description: 'Rate speed and responsiveness' },
  { key: 'overallExperience', label: 'Overall, how would you rate your experience?', description: 'Rate your overall satisfaction' },
];

export default function FeedbackForm({ visible, onClose, onSubmit, isSubmitting = false }: FeedbackFormProps) {
  const [ratings, setRatings] = useState<FeedbackData>({
    easeOfUse: 0,
    visualDesign: 0,
    navigation: 0,
    performance: 0,
    overallExperience: 0,
  });

  const handleRating = (questionKey: keyof FeedbackData, rating: number) => {
    setRatings(prev => ({
      ...prev,
      [questionKey]: rating,
    }));
  };

  const handleSubmit = () => {
    // Check if all questions are answered
    const unansweredQuestions = questions.filter(q => ratings[q.key as keyof FeedbackData] === 0);
    
    if (unansweredQuestions.length > 0) {
      Alert.alert(
        'Incomplete Feedback',
        'Please rate all questions before submitting.',
        [{ text: 'OK' }]
      );
      return;
    }

    onSubmit(ratings);
  };

  const handleClose = () => {
    if (isSubmitting) return;

    // Check if user has started filling the form
    const hasStarted = Object.values(ratings).some(rating => rating > 0);
    
    if (hasStarted) {
      Alert.alert(
        'Discard Feedback?',
        'Are you sure you want to close without submitting your feedback?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => {
              setRatings({
                easeOfUse: 0,
                visualDesign: 0,
                navigation: 0,
                performance: 0,
                overallExperience: 0,
              });
              onClose();
            }
          }
        ]
      );
    } else {
      onClose();
    }
  };

  const renderRatingStars = (questionKey: keyof FeedbackData, currentRating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleRating(questionKey, star)}
            style={styles.starButton}
          >
            <Icon
              name={star <= currentRating ? 'star' : 'star-border'}
              type="material"
              color={star <= currentRating ? '#FFD700' : '#666'}
              size={28}
            />
          </TouchableOpacity>
        ))}
        <Text style={styles.ratingText}>
          {currentRating > 0 ? `${currentRating}/5` : 'Not rated'}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={isSubmitting ? () => {} : handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Feedback</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton} disabled={isSubmitting}>
            <Icon name="close" type="material" color="#fff" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.description}>
            Help us improve your experience by rating different aspects of the app.
          </Text>

          {questions.map((question) => (
            <View key={question.key} style={styles.questionContainer}>
              <Text style={styles.questionLabel}>{question.label}</Text>
              <Text style={styles.questionDescription}>{question.description}</Text>
              {renderRatingStars(question.key as keyof FeedbackData, (ratings[question.key as keyof FeedbackData] as number) || 0)}
            </View>
          ))}

          <View style={styles.submitContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                Object.values(ratings).every(rating => rating > 0) && styles.submitButtonActive
              ]}
              onPress={handleSubmit}
              disabled={Object.values(ratings).some(rating => rating === 0) || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Feedback</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#202020',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  questionContainer: {
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
  },
  questionLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  questionDescription: {
    color: '#999',
    fontSize: 14,
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    color: '#999',
    fontSize: 14,
    marginLeft: 16,
  },
  submitContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  submitButton: {
    backgroundColor: '#333',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonActive: {
    backgroundColor: '#6200ee',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 