const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const firebaseApp = require('firebase/app');
const firebaseAuth = require('firebase/auth');
const path = require('path');

const usersCollection = "users"
const wordsCollection = "words"

// Service Account Key
const serviceAccount = require('./serviceAccountKey.json');

// Admin SDK Initialization (Server-side Firebase tasks like Firestore and user management)
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Firebase Client SDK Initialization (Client-side authentication)
const firebaseConfig = {
    apiKey: "AIzaSyA4-tNzlHM-6ziJlwDX10arvDI3oqOeBCA",
    //authDomain: "your-auth-domain",
    projectId: "desarrollo-web-matumbe",
    //storageBucket: "your-storage-bucket",
    //messagingSenderId: "your-messaging-sender-id",
    appId: "1097258782904",
};
const clientApp = firebaseApp.initializeApp(firebaseConfig);
const auth = firebaseAuth.getAuth(clientApp);

// Initialize Express
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for user authentication
const isUserAuthenticated = async (idToken) => {
    try {
        if (!idToken) return false;
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return !!decodedToken;
    } catch (error) {
        console.error("Authentication failed:", error.message);
        return false;
    }
};

const protectedRoute = async (req, res, next) => {
    try {
        const idToken = await auth.currentUser.getIdToken()
        if (await isUserAuthenticated(idToken)) {
            next();
            return
        } else {
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("/")
    }
};

const unsignedRoute = async (req, res, next) => {
    try {
        const idToken = await auth.currentUser.getIdToken()
        if (!idToken) {
            next()
            return
        }

        let isAuthenticated = await isUserAuthenticated(idToken)
        if (!isAuthenticated) {
            next();
            return
        }

        res.redirect('/translate')
    } catch (error) {
        next()
    }
};

// Routes
app.get('/', unsignedRoute, async (req, res) => {
    res.render(path.join(__dirname, 'views', 'index.ejs'), { errorMessage: null });
});

app.get('/translate', protectedRoute, async (req, res) => {
    res.render(path.join(__dirname, 'views', 'translate.ejs'), { initial: await getInitials(), errorMessage: null });
});

app.get('/add', protectedRoute, async (req, res) => {
    res.render(path.join(__dirname, 'views', 'add.ejs'), { initial: await getInitials(), errorMessage: null });
});

app.get('/speak', protectedRoute, async (req, res) => {
    res.render(path.join(__dirname, 'views', 'speak.ejs'), { initial: await getInitials(), cametsaWord: null, spanishWord: null, meaning: null, errorMessage: null });
});

app.get('/user', protectedRoute, async (req, res) => {
    try {
        let userData = await getUserData()
        userData.initial = await getInitials()
        res.render(path.join(__dirname, 'views', 'user.ejs'), userData);
    } catch (error) {
        console.log(error)
        res.render(path.join(__dirname, 'views', 'user.ejs')), { initial: await getInitials(), name: null, lastname: null, locality: null };
    }
});

app.get('/register', unsignedRoute, async (req, res) => {
    res.render(path.join(__dirname, 'views', 'register.ejs'), { errorMessage: null });
});

async function getInitials() {
    let { name, lastname } = await getUserData()
    nameInitial = name[0] || ""
    lastnameInitial = lastname[0] || ""

    return nameInitial + lastnameInitial
}

async function getUserData() {
    const userDoc = await db.collection(usersCollection).doc(auth.currentUser.email).get();
    if (userDoc.empty) {
        return res.status(404).send({ message: 'No documents found' });
    }

    let { name, lastname, locality } = userDoc.data()
    let userData = { name, lastname, locality }
    userData.email = auth.currentUser.email

    return userData
}

// User Registration (via Admin SDK)
app.post('/register', async (req, res) => {
    const { email, name, password, lastname, locality } = req.body;

    try {
        const userRecord = await admin.auth().createUser({ email, password });
        console.log('Successfully created new user:', userRecord.uid);
        const userData = { email, name, password, lastname, locality }
        const docRef = await db.collection(usersCollection).doc(email).set(userData);
        res.redirect('/translate');
    } catch (error) {
        console.error('Error creating new user:', error.message);
        res.render('register', { errorMessage: error.message });
    }
});

app.post('/users', async (req, res) => {
    const { name, lastname, locality } = req.body;
    let userData = null

    try {
        userData = { name: name, lastname: lastname, locality: locality }
        const docRef = await db.collection(usersCollection).doc(auth.currentUser.email).update(userData);
        res.redirect('/user');
    } catch (error) {
        console.error('Error creating new user:', error.message);
        userData.errorMessage = error.message
        userData.email = auth.currentUser.email
        res.render('user', userData);
    }
});

// User Login (via Client SDK)
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
    }

    firebaseAuth.signInWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
            const idToken = await userCredential.user.getIdToken();
            res.setHeader('Authorization', `Bearer ${idToken}`);
            res.redirect('/translate');
        })
        .catch((error) => {
            console.log(error)
            res.redirect("/")
        });
});

app.post('/signout', async (req, res) => {
    try {
        await auth.signOut()
    } catch (error) {
        // Fail open
    } finally {
        res.redirect("/")
    }
});

// Add a document to Firestore
app.post('/words', protectedRoute, async (req, res) => {
    console.log(req.body)

    const { word, translation, meaning, language } = req.body;

    let spanishWord = ""
    let cametsaWord = ""

    if (language === "Español") {
        spanishWord = word
        cametsaWord = translation
    } else {
        spanishWord = translation
        cametsaWord = word
    }

    try {
        const docRef = await db.collection(wordsCollection).doc(spanishWord).set({ spanishWord, cametsaWord, meaning });
        res.redirect('/add');
    } catch (error) {
        console.error("Error adding document:", error.message);
        res.render('add', { errorMessage: error.message });
    }
});

app.get('/words', protectedRoute, async (req, res) => {
    const { word, language } = req.query;


    try {
        const wordDoc = await db.collection(wordsCollection).doc(word).get();
        if (wordDoc.empty) {
            return res.status(404).send({ message: 'No documents found' });
        }

        let { cametsaWord, spanishWord, meaning } = wordDoc.data()
        let newWord = { cametsaWord, spanishWord, meaning }
        newWord.initial = await getInitials()

        res.render('speak', newWord);
    } catch (error) {
        console.error("Error fetching documents:", error.message);

        let data = { cametsaWord: "", spanishWord: "", meaning: "" }
        data.errorMessage = error.message
        data.initial = await getInitials()

        res.render(path.join(__dirname, 'views', 'speak.ejs'), data);
    }
});

// Add a document to Firestore
app.post('/add', protectedRoute, async (req, res) => {
    const { collection, data } = req.body;

    try {
        const docRef = await db.collection(collection).add(data);
        res.status(201).send({ message: 'Document added', id: docRef.id });
    } catch (error) {
        console.error("Error adding document:", error.message);
        res.status(500).send({ error: error.message });
    }
});

// Fetch all documents from a collection
app.get('/get/:collection', async (req, res) => {
    const { collection } = req.params;

    try {
        const snapshot = await db.collection(collection).get();
        if (snapshot.empty) {
            return res.status(404).send({ message: 'No documents found' });
        }

        const docs = [];
        snapshot.forEach((doc) => {
            docs.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).send(docs);
    } catch (error) {
        console.error("Error fetching documents:", error.message);
        res.status(500).send({ error: error.message });
    }
});

// Update a document in Firestore
app.put('/update/:collection/:id', protectedRoute, async (req, res) => {
    const { collection, id } = req.params;
    const { data } = req.body;

    try {
        await db.collection(collection).doc(id).update(data);
        res.status(200).send({ message: 'Document updated' });
    } catch (error) {
        console.error("Error updating document:", error.message);
        res.status(500).send({ error: error.message });
    }
});

// Delete a document in Firestore
app.delete('/delete/:collection/:id', protectedRoute, async (req, res) => {
    const { collection, id } = req.params;

    try {
        await db.collection(collection).doc(id).delete();
        res.status(200).send({ message: 'Document deleted' });
    } catch (error) {
        console.error("Error deleting document:", error.message);
        res.status(500).send({ error: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
