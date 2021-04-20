const AWS = require('aws-sdk');
const fs = require('fs');
const request = require('request-promise');

const { basename } = require('path');
import { sanitizeConfig } from './utils/configUtils';
import { ManagedUpload } from 'aws-sdk/lib/s3/managed_upload';
import SendData  = ManagedUpload.SendData;

const {
    PARTNER_IAM_API_KEY_ID,
    PARTNER_IAM_API_KEY_SECRET,
    PARTNER_UPLOAD_FOLDER,
    S3_REGION,
    S3_BUCKET_NAME,
    VERYFI_CLIENT_ID,
    VERYFI_USER_NAME,
    VERYFI_API_KEY,
    OCR_HOST,
    DOC_PATH,
} = process.env;

const awsConfig = {
    accessKeyId: PARTNER_IAM_API_KEY_ID as string,
    secretAccessKey: PARTNER_IAM_API_KEY_SECRET as string,
    region: S3_REGION as string,
};

const getFileContent = (filePath: string): string => {
    return fs.readFileSync(filePath);
    // return fileBuf.toString("base64");
};

console.log('AWS config: ', sanitizeConfig(awsConfig));

const s3 = new AWS.S3(awsConfig);

export const uploadFile = async (fileName: string, contentType: string, fileContent: string) => {
    const bucketConfig = {
        Bucket: S3_BUCKET_NAME as string,
        Key: `${PARTNER_UPLOAD_FOLDER as string}/${fileName}`,
        Body: fileContent,
        ContentType: contentType,
    };

    console.log('using bucket config', bucketConfig);

    const uploadStatus = s3.upload(bucketConfig, (err: Error, data: SendData) => {
        if (err) {
            console.log('[cb] err', JSON.stringify(err));
            throw err;
        }

        console.log('image uploaded', JSON.stringify(data));
    });

    return uploadStatus.promise();
};

export enum NumericBoolean {
    TRUE = 0,
    FALSE = 1,
}

export type OcrRequestPayloadType = {
    bucket: string;
    package_path: string;
    boost_mode: NumericBoolean;
    auto_delete: NumericBoolean;
}

export const initiateOcr = async (ocrReqPayload: OcrRequestPayloadType) => {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'CLIENT-ID': VERYFI_CLIENT_ID,
        'AUTHORIZATION': `apikey ${VERYFI_USER_NAME}:${VERYFI_API_KEY}`
    };

    const params = {
        method: 'POST',
        uri: `${OCR_HOST}${DOC_PATH}`,
        headers,
        json: ocrReqPayload,
    };

    return request.post(params)
};

export const processDocument = async (uploadInfo: SendData) => {
    const { Bucket, Key } = uploadInfo;

    const ocrRequestPayload = {
        bucket: Bucket,
        package_path: Key,
        boost_mode: NumericBoolean.TRUE,
        auto_delete: 1 as NumericBoolean.TRUE,
    };

    return await initiateOcr(ocrRequestPayload);
};

// @ts-ignore
const test = async () => {
    const fileName = process.argv[2];
    console.log(process.argv);
    const fileContent = getFileContent(fileName)
    console.log('trying to send', fileName);
    uploadFile(basename(fileName), 'image/png', fileContent)
        .then(async (res: SendData) => {
            console.log('[promise] res', JSON.stringify(res));
            const { Bucket, Key } = res;

            const ocrRequestPayload = {
                bucket: Bucket,
                package_path: Key,
                boost_mode: NumericBoolean.TRUE,
                auto_delete: 1 as NumericBoolean.TRUE,
            };


            await initiateOcr(ocrRequestPayload)
                .then((res: any) => {
                    console.log('OCR results', res);
                })
                .catch((err: Error) => {
                    console.log('Could not scan image', err);
                });
        })
        .catch(err => {
            console.log('[promise] error', err);
        })
};

// test();

