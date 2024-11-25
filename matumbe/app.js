const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Initialize Express
const app = express();
app.use(bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/translate', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'translate.html'));
});

app.get('/add', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'add.html'));
});

app.get('/speak', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'speak.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'user.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// Add a document to Firestore
app.post('/add', async (req, res) => {
    const { collection, data } = req.body;

    try {
        const docRef = await db.collection(collection).add(data);
        res.status(201).send({ message: 'Document added', id: docRef.id });
    } catch (error) {
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
        res.status(500).send({ error: error.message });
    }
});

// Update a document in Firestore
app.put('/update/:collection/:id', async (req, res) => {
    const { collection, id } = req.params;
    const { data } = req.body;

    try {
        await db.collection(collection).doc(id).update(data);
        res.status(200).send({ message: 'Document updated' });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.delete('/delete/:collection/:id', async (req, res) => {
    const { collection, id } = req.params;

    try {
        await db.collection(collection).doc(id).delete();
        res.status(200).send({ message: 'Document deleted' });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
