const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Enable enable pre-flight across the board
app.options('*', cors());

const ALLOWED_ORIGINS = [
    'http://localhost:3005',
];

app.use(cors({
    origin: (origin, cb) => {
        console.log('Evaluating CORS for origin', origin);

        if (!origin) return cb(null, true);

        if (origin.endsWith('.ssb.no')) {
            return cb(null, true);
        }

        if (ALLOWED_ORIGINS.indexOf(origin) === -1) {
            var msg = `CORS policy for ${origin} does not exist.`;
            return cb(new Error(msg), false);
        }

        return cb(null, true);
    }
}));


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
        return req.get(API_KEY) === process.env.BACKOFFICE_API_KEY;
    }
};

const getAuthUrl = () =>
    process.env.AUTH_URL;

const hasValidToken = async (idPortenInfo) => {
    if (!idPortenInfo) return false;
    const { accessToken, idToken } = idPortenInfo;
    const tokenInfo = {
        accessToken: accessToken.tokenValue,
        idToken: idToken.tokenValue,
    };

    const verifyEP = `${getAuthUrl()}/verify-token`;
    try {
        const idpResp = await axios.post(verifyEP, tokenInfo, {});
        return idpResp && (idpResp.status === 200);
    } catch (err) {
        console.log('error while verifying token', err);
        return false;
    }
};

const generateCustomToken = async (respondentId) =>
    admin.auth().createCustomToken(respondentId, {
        role: getRole(respondentId)
    });

const BACKOFFICE_UID = 'backoffice'
/**
 * Access to this endpoint it controlled by
 * network- and auth-policies. As on 11.05.2021
 * only consumption-survey-backoffice is allowed to call this endpoint
 */
app.post('/admin-login', async (req, res) => {
    generateCustomToken(BACKOFFICE_UID)
        .then((customToken) => {
            res.status(200).send({
                userInfo: {
                    user: BACKOFFICE_UID,
                    id: BACKOFFICE_UID,
                },
                firebaseToken: customToken,
            })
        })
        .catch(err => {
            console.log('firebase err', err);
            res.status(500).send({text: `Firebase error ${JSON.stringify(err)}`});
        });
});

/**
 * access to this endpoint is controlled by network- and auth policies.
 * As on 11.05.2021 this endpoint is open to WWW. A valid idToken from IDPorten
 * is required for successful issuing of a Firebase token.
 * As on 11.05.2021 access to the verify-token endpoint is also controlled by
 * network- and auth policies (on auth-idporten)
 */
app.post('/login', async (req, res) => {
    const {respondentInfo, idPortenInfo} = req.body;

    if (respondentInfo) {
        const {respondentId} = respondentInfo;

        if (!respondentId) {
            console.log('No respondentId .. returning 403');
            res.status(403).send({text: `Respondent Info not provided`});
        } else {
            const validToken = await hasValidToken(idPortenInfo);
            if (validToken) {
                // create a custom firebase token
                generateCustomToken(respondentId)
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
                        res.status(500).send({text: `Firebase error ${JSON.stringify(err)}`});
                    });
            } else {
                console.log('no valid token, 403');
                res.status(403).send({text: 'no valid token'})
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

