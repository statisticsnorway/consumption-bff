const fs = require('fs')

const protectSecretValue = (val) =>
    val && `${val.slice(0, 5)} .. ${val.slice(-5)}`;



const sanitizeConfig = (config) =>
    Object.keys(config)
        .reduce((acc, key) => ({
            ...acc,
            [key]: protectSecretValue(config[key]),
        }), {});


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

const fetchQuestionnaireData =  () => {

    admin.firestore()
        .collection(`/users`)
        .listDocuments()
        .then(usersDoc => {
            let questionData = []
            usersDoc.forEach(userDoc => {
                questionData.push(userDoc.collection('/questionnaire').listDocuments().then(questsDoc => {
                    let q = null
                    questsDoc.forEach(questDoc => {
                         q =  questDoc.get().then(snap => {
                            const questData = snap.data();
                            if(questData && questData.answers) {
                                //console.log(data.answers)
                                return userDoc.collection('/profile').listDocuments().then(profileDocs => {
                                    let f = null;
                                    profileDocs.forEach((profileDoc, index) => {
                                        if(profileDoc.id === 'about') {
                                            f = profileDoc.get().then(snap => {
                                                const data = snap.get('respondentDetails')
                                                if (data) {
                                                    return {
                                                        respondentId: data.respondentId,
                                                        ioNumber: data.ioNumber,
                                                        answers: questData.answers
                                                    }
                                                }
                                            })
                                        }
                                    })
                                    if(f) return f
                                })
                            }
                        })
                    })
                    if(q) return q
                }))

                Promise.all(questionData).then(results => {
                    fs.writeFile('../questionnaireData.json', JSON.stringify(results.filter(res => res !== undefined)), err => {
                        if(err) console.log(err)
                    })

                })
            });
        });


};

fetchQuestionnaireData()