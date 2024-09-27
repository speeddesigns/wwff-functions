import express from 'express';
const app = express();

import fetchWaymoJobs from './companies/waymo.js';
// const fetchTeslaJobs = require('./companies/tesla.js');
// const fetchLucidJobs = require('./companies/lucid.js');

// Use express's built-in body parser for JSON
app.use(express.json());  // No need for body-parser

// Route for checking server status
app.get('/', (req, res) => {
  res.send('Job Fetcher is running');
});

// Route to handle Pub/Sub-triggered job fetching (POST request)
app.post('/', async (req, res) => {
  console.log('Received Pub/Sub trigger');
  
  try {
    // Start the job-fetching task
    console.log('Running fetchWaymoJobs()...');
    await fetchWaymoJobs();

    // Optionally fetch from Tesla or Lucid as needed
    // console.log('Fetching jobs from Tesla...');
    // await fetchTeslaJobs();
    
    // console.log('Fetching jobs from Lucid...');
    // await fetchLucidJobs();
    
    console.log('All job-fetching tasks complete.');
    res.status(200).send('Job fetching completed successfully');
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
