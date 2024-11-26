const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const firebaseApp = require('firebase/app');
const firebaseAuth = require('firebase/auth');
const path = require('path');

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
    appId: "your-app-id",
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
    res.render(path.join(__dirname, 'views', 'index.ejs'));
});

app.get('/translate', protectedRoute, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'translate.html'));
});

app.get('/add', protectedRoute, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'add.html'));
});

app.get('/speak', protectedRoute, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'speak.html'));
});

app.get('/user', protectedRoute, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'user.html'));
});

app.get('/register', unsignedRoute, (req, res) => {
    res.render(path.join(__dirname, 'views', 'register.ejs'), { errorMessage: null });
});

// User Registration (via Admin SDK)
app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
    }

    try {
        const userRecord = await admin.auth().createUser({ email, password });
        console.log('Successfully created new user:', userRecord.uid);
        res.redirect('/translate');
    } catch (error) {
        console.error('Error creating new user:', error.message);
        res.render('register', { errorMessage: error.message });
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
            console.error('Error authenticating user:', error.message);
            res.status(401).json({ error: 'Invalid credentials' });
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



