const path = require('path');
const os = require('os');
const {getFirestore} = require('./setup');
import { initiateOcr, NumericBoolean, uploadFile } from './aws';

import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';
import { getFileContent } from './utils/fileUtils';
import { ManagedUpload } from 'aws-sdk/lib/s3/managed_upload';
import SendData = ManagedUpload.SendData;

const storage = new Storage();
const firestore = new Firestore();

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


exports.onNewReceipt = getFirestore()
    .document('/users/{userId}/receipts/{purchaseId}')
    .onCreate((snap: any, context: any) => {
        const {userId, purchaseId} = context.params;
        const {receiptId, receiptMetadata} = snap.data();
        const {name, fullPath, bucket, contentType} = receiptMetadata;

        console.log('metadata:', receiptMetadata);

        return new Promise(async (resolve, reject) => {
            if (bucket) {
                // const fileName = path.basename(name);
                const tmpFilePath = path.join(os.tmpdir(), name);

                const storageBucket = storage.bucket(bucket);
                const fileContent = await storageBucket.file(fullPath)
                    .download({destination: tmpFilePath})
                    .then(() => {
                        console.log('image downloaded successfully to ', tmpFilePath);
                    })
                    .then(() => {
                        return getFileContent(tmpFilePath);
                    })
                    .catch((err: any) => {
                        const msg = `Could not download receipt ...${JSON.stringify(err)}`;
                        console.log(msg);
                        return null;
                    });


                if (!fileContent) {
                    reject('Could not download receipt');
                } else {

                    console.log(`Uploading image content to AWS: (${fileContent.length})`);

                    await uploadFile(tmpFilePath, contentType, fileContent)
                        .then(async (uploadInfo: SendData) => {
                            const {Bucket, Key} = uploadInfo;

                            const ocrRequestPayload = {
                                bucket: Bucket,
                                package_path: Key,
                                boost_mode: NumericBoolean.TRUE,
                                auto_delete: 1 as NumericBoolean.TRUE,
                            };

                            return await initiateOcr(ocrRequestPayload)
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
                        });
                }
            } else {
                console.log('purchase created manually. skipping');
                resolve('Skipping CF execution');
            }
        });
    });
