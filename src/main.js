const express = require('express');
const app = express();

const fetchWaymoJobs = require('./companies/waymo');
// const fetchTeslaJobs = require('./companies/tesla');
// const fetchLucidJobs = require('./companies/lucid');


// Route for checking server status
app.get('/', (req, res) => {
  res.send('Job Fetcher is running');
});

// Start the Express server and listen on the Cloud Run-provided port
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);

  // Start job-fetching tasks
  runJobFetchers().catch(console.error);
});

async function runJobFetchers() {
  console.log('Fetching jobs from Waymo...');
  await fetchWaymoJobs();

//   console.log('Fetching jobs from Tesla...');
//   await fetchTeslaJobs();

//   console.log('Fetching jobs from Lucid...');
//   await fetchLucidJobs();

  console.log('All job-fetching tasks complete.');
}