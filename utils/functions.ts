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