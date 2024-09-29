import express from 'express';
import { fetchWaymoJobs } from './companies/waymo.js';  // Updated to match the new function name
import { updateJobsWithOpenCloseLogic } from './db.js';  // Updated to match the correct function

const app = express();

// Middleware to parse JSON body in incoming requests
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Job Fetcher is running');
});

// Pub/Sub-triggered job-fetching route (POST)
app.post('/', async (req, res) => {
  console.log('Received Pub/Sub trigger');

  try {
    // Fetch jobs from Waymo
    console.log('Starting job fetching for Waymo...');
    const { jobs, company } = await fetchWaymoJobs();  // Updated function call

    // Save or update jobs in Firestore
    console.log(`Updating jobs for ${company} in Firestore...`);
    await updateJobsWithOpenCloseLogic(jobs);  // Updated function call

    console.log('All job-fetching tasks complete.');
    res.status(200).send('Job fetching and updating completed successfully');
  } catch (error) {
    console.error('Error during job fetching or updating:', error);
    res.status(500).send('An error occurred during job fetching or updating');
  }
});

export default app;


// Start the Express server and listen on the Cloud Run-provided port
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});