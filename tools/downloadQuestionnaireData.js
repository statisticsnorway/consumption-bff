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

const fetchQuestionnaireData = async () => {

    const usersDocs = await admin.firestore()
        .collection(`/users`)
        .listDocuments()

    const t = await usersDocs.reduce(async (acc, userDoc) => {
        const respondentId = userDoc.path.split('/')[1]
        return acc.then(async result => {
            //console.log(result)
            const f =  await userDoc.collection('/questionnaire')
                .listDocuments()
                .then(async questsRef => {
                    const quest = await admin.firestore().getAll(...questsRef)
                    return quest.reduce((acc, q) => {
                        if(q.exists) {
                            const qData = q.data()
                            return (qData && qData.answers)
                                ? {...acc, respondentId: respondentId, answers:qData.answers}
                                : acc
                        }
                    }, null)

                })
            return f ? [...result, f] : result
        })
    }, Promise.resolve([]))
    console.log(t)
    fs.writeFile('../questionnaireData.json', JSON.stringify(t), err => {
        if(err) console.log(err)
    })


    /*.then(usersDoc => {
        usersDoc.forEach(userDoc => {
            const respondentId = userDoc.path.split('/')[1]
            userDoc.collection('/questionnaire')
                .listDocuments()
                .then(async questRef => {
                    const allQuests = await admin.firestore().getAll(...questRef)
                    console.log(allQuests)
                })
            /*questionData.push(userDoc.collection('/questionnaire').listDocuments().then(questsDoc => {
                let q = null
                questsDoc.forEach(questDoc => {
                     q =  questDoc.get().then(snap => {
                        const questData = snap.data();
                        if(questData && questData.answers) {
                            //console.log(data.answers)
                            return {respondentId: questData._path.segments[1], answers: questData.answers}
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
    });*/


};

fetchQuestionnaireData()