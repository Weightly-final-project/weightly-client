import AWS from 'aws-sdk';

AWS.config.update({
    region: 'eu-west-1',
    accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
});

const client = new AWS.S3();

const uploadFile = async (uri: string, key: string = 'image1.jpg', bucketName: string = 'rbuixcube') => {
    const imageData = await fetch(uri);
    const blob = await imageData.blob();
    const res = await client.upload({
        Bucket: bucketName,
        Key: key,
        Body: blob,
    }).promise();
    return res;
};

export { client, uploadFile };