// eslint-disable-next-line no-unused-vars
import {ObjectMetadata} from "firebase-functions/lib/providers/storage";
// eslint-disable-next-line no-unused-vars
import {Storage} from "@google-cloud/storage";

const request = require("request-promise");
const {getBucket} = require("./setup");
const path = require("path");
const os = require("os");
const fs = require("fs");

const {
  OCR_HOST,
  DOC_PATH,
  API_KEY,
  CLIENT_ID,
  USER_NAME,
} = process.env;


const dumpObjDetails = (obj: ObjectMetadata) => {
  console.log("-----------");
  console.log(`New object added: ${obj.id}`);
  console.log(`  - name: ${obj.name}`);

  console.log(`  - mediaLink: ${obj.mediaLink}`);
  console.log(`  - selfLink: ${obj.selfLink}`);
  console.log("-----------");
};

const base64EncodeFile = (filePath: string): string => {
  const fileBuf = fs.readFileSync(filePath);
  return fileBuf.toString("base64");
};

exports.imageUploadListener = getBucket()
    .onFinalize(async (obj: ObjectMetadata) => {
      dumpObjDetails(obj);

      // setup temp download location
      const bucketPath = obj.name as string;
      const [,fileExtn] = (obj.contentType as string).split('/');
      const fileName = path.basename(bucketPath);
      const tempFilePath = path.join(os.tmpdir(), `${fileName}.${fileExtn}`);

      // get the bucket!
      const storage = new Storage();
      const bucket = storage.bucket(obj.bucket);

      // download image
      const base64 = await bucket.file(bucketPath)
          .download({
            destination: tempFilePath,
          })
          .then(() => {
            console.log("image successfully downloaded to ", tempFilePath);
          })
          .then(() => {
            const base64 = base64EncodeFile(tempFilePath);

            return base64;
          });

      console.log("Base64 content", `${base64.substr(0, 25)}...`);

      // setup OCR request
      const fileData = `${obj.contentType};base64;${base64}`;
      const formData = {
        file_data: fileData,
        file_name: fileName,
        boost_mode: 1,
      };
      const options = {
        method: "POST",
        uri: `${OCR_HOST}${DOC_PATH}`,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "CLIENT-ID": CLIENT_ID,
          "AUTHORIZATION": `apikey ${USER_NAME}:${API_KEY}`,
        },
        formData,
      };

      console.log("Sending: ", JSON.stringify(options));
      request.post(options, (err: any, resp: any, body: any) => {
        if (err) {
          console.log("**** ERROR", err);
        } else {
          console.log("Response body from OCR", body);
        }
      });
    });

