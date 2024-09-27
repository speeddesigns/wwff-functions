const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

// Initialize Firestore (replace with your own Firestore credentials or use Firebase environment)
admin.initializeApp({
    credential: admin.credential.applicationDefault(), // For local use, ensure you've set GOOGLE_APPLICATION_CREDENTIALS
});
const db = admin.firestore();

const app = express();
const port = process.env.PORT || 8080;

// Define the target URL to fetch data from
const TARGET_URL = 'https://jsonplaceholder.typicode.com/posts'; // Example placeholder API

app.get('/', async (req, res) => {
    try {
        // Step 1: Fetch data from a URL
        const response = await axios.get(TARGET_URL);
        const data = response.data;

        // Step 2: Parse results (for simplicity, we'll just store the first item from the response)
        const parsedData = {
            title: data[0].title,
            body: data[0].body,
            id: data[0].id,
        };

        // Step 3: Store parsed data in Firestore
        const docRef = db.collection('jobs').doc(parsedData.id.toString());
        await docRef.set(parsedData);

        // Step 4: Return success message and end the request
        res.send(`Data added to Firestore: ${JSON.stringify(parsedData)}`);
    } catch (error) {
        console.error('Error fetching or saving data:', error);
        res.status(500).send('Failed to fetch or save data.');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});