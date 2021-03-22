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

app.post('/login', (req, res) => {
    const user = req.body.user;
    const pass = req.body.pass;

    if (user) {
        // create a custom token
        admin.auth().createCustomToken(user, {
            role: getRole(user)
        })
            .then((customToken) => {
                res.status(200).send({
                    userInfo: user,
                    firebaseToken: customToken,
                })
            })
    } else {
        res.status(403).send({text: `User ${user} not allowed`});
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

