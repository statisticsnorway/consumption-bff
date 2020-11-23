const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();

admin.initializeApp({
    credential: admin.credential.cert('./secure/serviceAccountKey.json')
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

const allowedUsers = {
    abc: { id: 'abc', firstName: 'abc', lastName: 'def', email: 'abc.def@abc.def.com' },
    prabu: { id: 'prabu', firstName: 'prabu', lastName: 'venkat', email: 'p.v@pv.com' },
};

app.post('/login', (req, res) => {
    const user = req.body.user;
    const pass = req.body.pass;

    if (Object.keys(allowedUsers).includes(user)) {
        // create a custom token
        admin.auth().createCustomToken(user, {
            role: user === 'prabu' ? ['main', 'member'] : ['member']
        })
            .then((customToken) => {
                res.cookie('firebaseToken', customToken, { httpOnly: true });
                res.status(200).send({
                    userInfo: allowedUsers[user],
                })
            })
    } else {
        res.status(403).send({text: `User ${user} not allowed`});
    }
});

app.get('/profile', (req, res) => {
    const token = req.cookies['firebaseToken'];
    if (token) {
        res.send(200).send('Token received in header');
    } else {
        res.status(403).send('Token not found in header');
    }
});

app.listen(3005, () => {
    console.log('App initialized and running on port 3005');
    checkAdmin();
});
