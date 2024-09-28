console.log(`Alright! I'm fired up! Let's do this thing!`);

import express from 'express';
import fetchWaymoJobs from './companies/waymo.js'; // Fetch Waymo jobs
import { updateJobs } from './db.js'; // Assuming this handles DB operations

const app = express();

// Use express's built-in body parser for JSON
app.use(express.json());  // No need for body-parser

// // Route for checking server status
// app.get('/', (req, res) => {
//   res.send('Job Fetcher is running');
// });

// Route to handle Pub/Sub-triggered job fetching (POST request)
app.post('/', async (req, res) => {
  console.log('Received Pub/Sub trigger');
  
  try {
    // Fetch jobs from Waymo
    console.log('Fetching jobs from Waymo...');
    const waymoJobs = await fetchWaymoJobs();

    // Save or update jobs in Firestore
    console.log('Updating jobs in Firestore...');
    await updateJobs('Waymo', waymoJobs); // Pass the fetched jobs to be handled in the DB

    console.log('All job-fetching tasks complete.');
    res.status(200).send('Job fetching and updating completed successfully');
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).send('Error fetching jobs');
  }
});

// Start the Express server and listen on the Cloud Run-provided port
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});