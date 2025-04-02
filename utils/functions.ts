export const getFilenameFromS3Uri = (uri: string) => {
    const parts = uri.split("/")
    return parts[parts.length - 1]
}