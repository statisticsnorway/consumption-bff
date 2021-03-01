const functions = require("firebase-functions");
const admin = require("firebase-admin");

let INITIALIZED = false;

const CF_REGION = "europe-west1";

const init = () => {
  admin.initializeApp();
  INITIALIZED = true;
};

export const getFirestore = () => {
  if (!INITIALIZED) {
    init();
  }

  return functions
      .region(CF_REGION)
      .firestore;
}

export const getBucket = () => {
  if (!INITIALIZED) {
    init();
  }
  return functions
      .region(CF_REGION)
      .storage
      .object();
};
