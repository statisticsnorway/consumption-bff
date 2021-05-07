const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const app = express();

const isLocal = () => process.env.DEPLOYMENT_ENV === 'local'

const protectSecretValue = (val) =>
    `${val.slice(0, 5)} ... ${val.slice(-5)}`;

const sanitizeConfig = (config) =>
    Object.keys(config)
        .reduce((acc, key) => ({
            ...acc,
            [key]: protectSecretValue(config[key]),
        }), {});


console.log('loading config from ', process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Please provide a valid firebase service account json (process.env.FIREBASE_SERVICE_ACCOUNT_JSON)');
}
const adminConfig = require(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
console.log('loaded config', sanitizeConfig(adminConfig));

admin.initializeApp({
    credential: admin.credential.cert(adminConfig)
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

const checkAdmin = () => {
    admin.firestore()
        .listCollections('searchTerms')
        .then((collections) => {
            collections.forEach((col) => {
                console.log('found', col.id);
            })
        })
};

// todo: All of these will be replaced with proper tokens/user access..
const allowedUsers = {
    abc: {id: 'abc', firstName: 'abc', lastName: 'def', email: 'abc.def@abc.def.com'},
    prabu: {id: 'prabu', firstName: 'prabu', lastName: 'venkat', email: 'p.v@pv.com'},
    backoffice: {id: 'backoffice', firstName: 'CS', lastName: 'backoffice', email: 'cs.bo@ssb.no'}
};

// todo: All of these will be replaced with proper tokens/user access..
const getRole = (userName) => {
    switch (userName) {
        case 'backoffice':
        case 'prabu':
            return 'admin';
        default:
            return 'respondent';
    }
};

const API_KEY = 'x-api-key';

const hasValidApiKey = (req) => {
    if (!process.env.BACKOFFICE_API_KEY) {
        console.log('no backoffice api key configured!');
        return true;
    } else {
        console.log(protectSecretValue(process.env.BACKOFFICE_API_KEY));
        console.log('request header', req.headers, req.get(API_KEY));
        return req.header('API_KEY') === process.env.BACKOFFICE_API_KEY;
    }
};

// TODO: Read from prcess.env
const getAuthUrl = () =>
    // process.env.AUTH_URL;
    "https://auth-idporten.staging-bip-app.ssb.no";

const hasValidToken = async (idPortenInfo) => {
    const verifyEP = `${getAuthUrl()}/verify-token`;
    await axios.post(verifyEP, idPortenInfo, {})
        .then(res => {
            console.log('response', res);
            return true;
        })
        .catch(err => {
            console.log('error', err);
            return false;
        })
};

app.post('/login', async (req, res) => {
    const {respondentInfo, idPortenInfo} = req.body;

    if (respondentInfo) {
        const {respondentId} = respondentInfo;

        if (!respondentId) {
            console.log('No respondentId .. returning 403');
            res.status(403).send({text: `Respondent Info not provided`});
        } else {
            if (hasValidApiKey(req) || await hasValidToken(idPortenInfo)) {
                // create a custom token
                admin.auth().createCustomToken(respondentId, {
                    role: getRole(respondentId)
                })
                    .then((customToken) => {
                        res.status(200).send({
                            userInfo: {
                                user: respondentId,
                                id: respondentId,
                            },
                            firebaseToken: customToken,
                            respondentDetails: respondentInfo,
                        })
                    })
                    .catch(err => {
                        console.log('firebase err', err);
                        res.status(500).send({ text: `Firebase error ${JSON.stringify(err)}`});
                    });
            } else {
                console.log('no API_KEY or valid token, 403');
                res.status(403).send({text: 'No API_KEY or valid token'})
            }
        }
    } else {
        console.log('no respondent info', 403);
        res.status(403).send({text: `Respondent Info not provided`});
    }
});


app.get('/profile', (req, res) => {
    const token = req.cookies['firebaseToken'];
    if (token) {
        res.status(200).send('Token received in header');
    } else {
        res.status(403).send('Token not found in header');
    }
});

app.listen(3005, () => {
    console.log('App initialized and running on port 3005');
    checkAdmin();
});

