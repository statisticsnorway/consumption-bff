const FIRESTORE_PATH_REGEX = /users\/(\w+)\/receipts\/(\w+)\/(\w+\.\w+)/g;
const extractFirestoreInfo = (path) => {
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

const tp = 'users/abc/receipts/U6WhxCliaHNo6oGzZxe7/16143473608144594764898861406605.jpg';
console.log(extractFirestoreInfo(tp));
