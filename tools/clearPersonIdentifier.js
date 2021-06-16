const admin = require('firebase-admin');

console.log('loading config from ', process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Please provide a valid firebase service account json (process.env.FIREBASE_SERVICE_ACCOUNT_JSON)');
}
const adminConfig = require(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
console.log('loaded config', sanitizeConfig(adminConfig));

admin.initializeApp({
    credential: admin.credential.cert(adminConfig)
});

const clearPersonIdentifier = () => {
    admin.firestore()
        .collection(`/users`)
        .listDocuments()
        .then(usersDoc => {
            usersDoc.forEach(userDoc => {
                userDoc.get()
                    .then(snap => {
                        const data = snap.data();
                        const { respondentDetails } = data;
                        userDoc.set({
                            respondentDetails: {
                                ...respondentDetails,
                                pid: ''
                            }
                        }, {merge: true});
                    });
            });
        });
};

clearPersonIdentifier();
