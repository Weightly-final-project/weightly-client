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

export const convertToStandartSize = (size: {
    width_cm: number;
    height_cm: number;
    length_cm: number;
  }) => {
    const height_cm = Math.round(size.height_cm / 2) * 2
    const width_cm = Math.round(size.width_cm)
    const length_cm = Math.round(size.length_cm / 100) * 100
    return {
      height_cm,
      width_cm,
      length_cm,
    }
};

export const bigBboxCalculator = (predictions: readonly any[]) => {
  return predictions.
  filter((prediction) => prediction.object == "pine")
  .reduce((acc: any, prediction: any) => {
    if (prediction.bbox) {
      const [ minX, minY, maxX, maxY ] = prediction.bbox
      acc.minX = Math.min(acc.minX, minX)
      acc.minY = Math.min(acc.minY, minY)
      acc.maxX = Math.max(acc.maxX, maxX)
      acc.maxY = Math.max(acc.maxY, maxY)
    }
    return acc
  }, { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 })
}