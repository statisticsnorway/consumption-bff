// eslint-disable-next-line no-unused-vars
import { ObjectMetadata } from 'firebase-functions/lib/providers/storage';
// eslint-disable-next-line no-unused-vars
import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';

const request = require('request-promise');
const {getBucket} = require('./setup');
const path = require('path');
const os = require('os');
const fs = require('fs');

const {
    OCR_HOST,
    DOC_PATH,
    API_KEY,
    CLIENT_ID,
    USER_NAME,
} = process.env;


const dumpObjDetails = (obj: ObjectMetadata) => {
    console.log('-----------');
    console.log(`New object added: ${obj.id}`);
    console.log(`  - name: ${obj.name}`);

    console.log(`  - mediaLink: ${obj.mediaLink}`);
    console.log(`  - selfLink: ${obj.selfLink}`);
    console.log('-----------');
};

const base64EncodeFile = (filePath: string): string => {
    return fs.readFileSync(filePath, 'base64');
    // return fileBuf.toString("base64");
};

/*
const sanitizeFileExtn = (type: string): string => {
  switch (type) {
    case "jpeg":
      return "jpg";
    default:
      return type;
  }
};*/

type FirestoreInfo = {
    userName: string;
    purchaseId: string;
    receiptId: string;
};

const FIRESTORE_PATH_REGEX = /users\/(\w+)\/receipts\/(\w+)\/(\w+\.\w+)/g;
const extractFirestoreInfo = (path: string): FirestoreInfo | null => {
    let regexResult = FIRESTORE_PATH_REGEX.exec(path);

    console.log('regex', FIRESTORE_PATH_REGEX);
    console.log('regexResult', path, '=>', regexResult);

    if (regexResult) {
        return {
            userName: regexResult[1],
            purchaseId: regexResult[2],
            receiptId: regexResult[3],
        }
    } else {
        return null;
    }
};

const storage = new Storage();
const firestore = new Firestore();

enum PurchaseStatus {
    OCR_ERROR = 'OCR_ERROR',
    OCR_COMPLETE = 'OCR_COMPLETE',
};

const handleOCRResults = (firestoreInfo: FirestoreInfo) => async (body: any) => {
    console.log('Received success result from OCR', JSON.stringify(body));

    if (firestoreInfo) {
        const {userName, purchaseId, receiptId} = firestoreInfo;
        const purchasePath = `/users/${userName}/purchases/${purchaseId}`;

        firestore.doc(purchasePath)
            .set({
                ocrResults: {
                    [receiptId]: body
                },
                status: PurchaseStatus.OCR_COMPLETE,
            }, {merge: true})
            .then(updRes => {
                console.log(`updated purchase ${purchaseId}`, JSON.stringify(updRes));
            })
            .catch(err => {
                console.log(`*** ERR while updating ${purchaseId}`, JSON.stringify(err));
            });
    } else {
        console.log('Unable to extract firestore info', firestoreInfo);
    }
};

const handleOCRErrors = (firestoreInfo: FirestoreInfo) => async (err: any) => {
    console.log('**** ERROR', err);
    if (firestoreInfo) {
        const {userName, purchaseId, receiptId} = firestoreInfo;
        const purchasePath = `/users/${userName}/purchases/${purchaseId}`;

        firestore.doc(purchasePath)
            .set({
                status: PurchaseStatus.OCR_ERROR,
                ocrError: {
                    [receiptId]: err,
                },
            })
            .then(updRes => {
                console.log(`updated purchase ${purchaseId}`, JSON.stringify(updRes));
            })
            .catch(err => {
                console.log(`*** ERR while updating ${purchaseId}`, JSON.stringify(err));
            });
    } else {
        console.log('Could not extract firestore info from path', firestoreInfo);
    }
};

exports.imageUploadListener = getBucket()
    .onFinalize(async (obj: ObjectMetadata) => {
        dumpObjDetails(obj);

        // setup temp download location
        const bucketPath = obj.name as string;
        const firestoreInfo = extractFirestoreInfo(bucketPath) as FirestoreInfo;
        console.log('firestoreInfo', firestoreInfo);

        if (!firestoreInfo) {
            console.log('*** ERROR: what do we do  now ??!!!!');
        }

        // const [, fileType] = (obj.contentType as string).split("/");
        // const fileExtn = sanitizeFileExtn(fileType);
        const fileName = path.basename(bucketPath);
        const tempFilePath = path.join(os.tmpdir(), fileName);

        // get the bucket!
        const bucket = storage.bucket(obj.bucket);

        // download image
        const base64 = await bucket.file(bucketPath)
            .download({
                destination: tempFilePath,
            })
            .then(() => {
                console.log('image successfully downloaded to ', tempFilePath);
            })
            .then(() => {
                const base64 = base64EncodeFile(tempFilePath);

                return base64;
            });

        console.log('Base64 content', `${base64.substr(0, 25)}...`);

        // setup OCR request
        // const fileData = `${obj.contentType};base64;${base64}`;
        const formData = {
            file_name: tempFilePath,
            boost_mode: 1,
            file_data: base64,
        };
        const options = {
            method: 'POST',
            uri: `${OCR_HOST}${DOC_PATH}`,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'CLIENT-ID': CLIENT_ID,
                'AUTHORIZATION': `apikey ${USER_NAME}:${API_KEY}`,
            },
            json: formData,
        };

        console.log('Sending: ', JSON.stringify(options));
        request.post(options)
            .then(handleOCRResults(firestoreInfo))
            .catch(handleOCRErrors(firestoreInfo));
    });

