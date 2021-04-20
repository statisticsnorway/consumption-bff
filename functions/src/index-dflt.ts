// eslint-disable-next-line no-unused-vars
// import { ObjectMetadata } from 'firebase-functions/lib/providers/storage';
// eslint-disable-next-line no-unused-vars
import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';

const request = require('request-promise');
const {getFirestore} = require('./setup');
const path = require('path');
const os = require('os');
const fs = require('fs');

const storage = new Storage();
const firestore = new Firestore();

const {
    OCR_HOST,
    DOC_PATH,
    API_KEY,
    CLIENT_ID,
    USER_NAME,
} = process.env;

enum PurchaseStatus {
    OCR_ERROR = 'OCR_ERROR',
    OCR_COMPLETE = 'OCR_COMPLETE',
};

/*
const dumpObjDetails = (obj: ObjectMetadata) => {
    console.log('-----------');
    console.log(`New object added: ${obj.id}`);
    console.log(`  - name: ${obj.name}`);

    console.log(`  - mediaLink: ${obj.mediaLink}`);
    console.log(`  - selfLink: ${obj.selfLink}`);
    console.log('-----------');
};

 */

const base64EncodeFile = (filePath: string): string => {
    return fs.readFileSync(filePath, 'base64');
    // return fileBuf.toString("base64");
};

exports.onNewReceipt = getFirestore()
    .document('/users/{userId}/receipts/{purchaseId}')
    .onCreate((snap: any, context: any) => {
        const {userId, purchaseId} = context.params;
        const {receiptId, receiptMetadata} = snap.data();
        const {name, fullPath, bucket} = receiptMetadata;

        console.log('metadata:', receiptMetadata);

        return new Promise(async (resolve, reject) => {
            if (bucket) {
                // const fileName = path.basename(name);
                const tmpFilePath = path.join(os.tmpdir(), name);

                const storageBucket = storage.bucket(bucket);
                const base64 = await storageBucket.file(fullPath)
                    .download({destination: tmpFilePath})
                    .then(() => {
                        console.log('image downloaded successfully to ', tmpFilePath);
                    })
                    .then(() => {
                        return base64EncodeFile(tmpFilePath);
                    })
                    .catch((err: any) => {
                        const msg = `Could not download receipt ...${JSON.stringify(err)}`;
                        console.log(msg);
                        return null;
                    });

                if (!base64) {
                    reject('Could not download receipt');
                } else {

                    console.log('Base64 content', `${(base64).substr(0, 25)}...`);

                    // setup OCR request
                    // const fileData = `${obj.contentType};base64;${base64}`;
                    const formData = {
                        file_name: tmpFilePath,
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
                    await request.post(options)
                        .then((body: any) => {
                            const purchase = `/users/${userId}/purchases/${purchaseId}`;
                            firestore.doc(purchase)
                                .set({
                                    ocrResults: {
                                        [receiptId]: body
                                    },
                                    status: PurchaseStatus.OCR_COMPLETE
                                }, {merge: true})
                                .then(updRes => {
                                    const msg = `updated purchase ${purchaseId}, ${JSON.stringify(updRes)}`;
                                    console.log(msg);
                                    resolve(msg)
                                })
                                .catch(err => {
                                    const msg = `Unable to update ${purchaseId}: ${JSON.stringify(err)}`;
                                    console.log(msg);
                                    reject(msg);
                                })
                        })
                        .catch((err: any) => {
                            const msg = `OCR Error: ${JSON.stringify(err)}`;
                            console.log(msg);
                            reject(msg);
                        });
                }
            } else {
                console.log('purchase created manually. skipping');
                resolve('Skipping CF execution');
            }
        });
    });
