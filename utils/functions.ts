import { format } from "date-fns"

// Helper functions for extracting filename from S3 URI
export const getFilenameFromS3Uri = (uri: string) => {
    const parts = uri.split("/")
    return parts[parts.length - 1]
}

// Helper function to format date
export const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), "MMMM d, yyyy 'at' h:mm a")
  } catch (e) {
    return dateString
  }
}

export const totalVolumeCalculator = (predictions: any[]) => {
    return predictions.reduce((acc: number, prediction: any) => {
        if (prediction.volume_cm3) {
          return acc + prediction.volume_cm3
        }
        return acc
    }, 0.0)
};

export const avarageSizeCalculator = (predictions: any[]) => {
    const avarageSizeCalc = predictions.reduce((acc: any, prediction: any) => {
        if (prediction.width_cm && prediction.height_cm && prediction.length_cm) {
          acc.width_cm += prediction.width_cm
          acc.height_cm += prediction.height_cm
          acc.length_cm += prediction.length_cm
        }
        return acc
    }, { width_cm: 0, height_cm: 0, length_cm: 0 });

    const count = predictions.length

    if (count > 0) {
        return {
          width_cm: avarageSizeCalc.width_cm / count,
          height_cm: avarageSizeCalc.height_cm / count,
          length_cm: avarageSizeCalc.length_cm / count,
        }
    }
    
    return {
      width_cm: 0,
      height_cm: 0,
      length_cm: 0,
    }
};