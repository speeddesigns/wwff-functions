import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { updateJobsWithOpenCloseLogic } from './db.js';

const app = express();

// Middleware to parse JSON body in incoming requests
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Job Fetcher is running');
});

// Dynamically import job fetch functions from companies
async function importJobFetchers() {
  const companiesDir = path.resolve('./src/companies');
  const files = await fs.readdir(companiesDir);
  const jobFetchers = {};

  for (const file of files) {
    if (file.endsWith('.js')) {
      const modulePath = `./companies/${file}`;
      const module = await import(modulePath);
      const companyName = file.replace('.js', '').replace(/\b\w/g, l => l.toUpperCase());
      
      // Look for a function that starts with 'fetch' and ends with 'Jobs'
      const fetchFunction = Object.values(module).find(
        func => typeof func === 'function' && 
        func.name.startsWith('fetch') && 
        func.name.endsWith('Jobs')
      );

      if (fetchFunction) {
        jobFetchers[companyName] = fetchFunction;
      }
    }
  }

  return jobFetchers;
}

// Pub/Sub-triggered job-fetching route (POST)
app.post('/', async (req, res) => {
  console.log('Received Pub/Sub trigger');

  try {
    // Dynamically import and fetch jobs from all companies
    const jobFetchers = await importJobFetchers();
    console.log('Job fetchers found:', Object.keys(jobFetchers));

    // Fetch and update jobs for each company
    const jobResults = [];
    for (const [companyName, fetchFunction] of Object.entries(jobFetchers)) {
      console.log(`Fetching jobs for ${companyName}`);
      const result = await fetchFunction();
      
      // Update jobs in Firestore
      await updateJobsWithOpenCloseLogic(companyName, result.jobs);
      
      jobResults.push({
        company: companyName,
        jobCount: result.jobs.length
      });
    }

    console.log('Job fetching tasks complete.');
    res.status(200).json({
      message: 'Job fetching and updating completed successfully',
      results: jobResults
    });
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
