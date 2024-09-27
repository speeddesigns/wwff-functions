//used in company files
import { get } from 'https';
import { load } from 'cheerio';
import { saveJobs } from '../db';

import { json } from 'body-parser';
import express from 'express';
const app = express();

import fetchWaymoJobs from './companies/waymo';
// const fetchTeslaJobs = require('./companies/tesla');
// const fetchLucidJobs = require('./companies/lucid');

app.use(json());  // To parse JSON messages from Pub/Sub

// Route for checking server status
app.get('/', (req, res) => {
  res.send('Job Fetcher is running');
});

// Route to handle Pub/Sub-triggered job fetching (POST request)
app.post('/', async (req, res) => {
  console.log('Received Pub/Sub trigger');
  
  try {
    // Start the job-fetching task
    console.log('Fetching jobs from Waymo...');
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