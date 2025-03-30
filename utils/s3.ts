import AWS from 'aws-sdk';

AWS.config.update({
    region: 'eu-west-1',
    accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
});

const client = new AWS.S3();

const uploadFile = async (uri: string, key: string = 'image1.jpg', bucketName: string = 'weighlty') => {
    const imageData = await fetch(uri);
    const blob = await imageData.blob();
    const res = await client.upload({
        Bucket: bucketName,
        Key: key,
        Body: blob,
    }).promise();
    return res;
};

const getFiles = (urls: string[], bucketName: string = 'weighlty') => {
    return Promise.all(urls.map((item) => {
        return (
        getFile(item.split('/').splice(3).join('/'), bucketName)
    )}));
}

const getFile = async (key: string = 'image1.jpg', bucketName: string = 'weighlty') => {
    try {
        const params = {
            Bucket: bucketName,
            Key: key,
        };

        // Get the file metadata first to check size
        const headData = await client.headObject(params).promise();
        const contentType = headData.ContentType || 'application/octet-stream';
        
        // Use presigned URL for larger files
        const signedUrl = client.getSignedUrl('getObject', {
            Bucket: bucketName,
            Key: key,
            Expires: 60 * 24 * 60 // URL expires in 24 hours
        });
        
        return {
            url: signedUrl,
            contentType: contentType,
            // No data property - will be loaded via URL
        };
    } catch (error) {
        console.error('Error getting file from S3:', error, key, bucketName);
        return
    }
};

export { client, uploadFile, getFile, getFiles };