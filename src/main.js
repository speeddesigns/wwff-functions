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

// Process jobs for a single company
async function processCompanyJobs(companyName, fetchFunction) {
  try {
    console.log(`Fetching jobs for ${companyName}`);
    const result = await fetchFunction();
    
    // Update jobs in Firestore
    await updateJobsWithOpenCloseLogic(companyName, result.jobs);
    
    return {
      company: companyName,
      jobCount: result.jobs.length,
      status: 'success'
    };
  } catch (error) {
    console.error(`Error processing jobs for ${companyName}:`, error);
    return {
      company: companyName,
      jobCount: 0,
      status: 'error',
      error: error.message
    };
  }
}

// Pub/Sub-triggered job-fetching route (POST)
app.post('/', async (req, res) => {
  console.log('Received Pub/Sub trigger');

  try {
    // Dynamically import and fetch jobs from all companies
    const jobFetchers = await importJobFetchers();
    console.log('Job fetchers found:', Object.keys(jobFetchers));

    // Process jobs for all companies concurrently
    const jobResults = await Promise.allSettled(
      Object.entries(jobFetchers).map(([companyName, fetchFunction]) => 
        processCompanyJobs(companyName, fetchFunction)
      )
    );

    // Filter and log results
    const processedResults = jobResults.map(result => 
      result.status === 'fulfilled' ? result.value : result.reason
    );

    const successfulCompanies = processedResults.filter(r => r.status === 'success');
    const failedCompanies = processedResults.filter(r => r.status === 'error');

    console.log('Job fetching tasks complete.');
    res.status(200).json({
      message: 'Job fetching and updating completed',
      successfulCompanies: successfulCompanies.length,
      failedCompanies: failedCompanies.length,
      results: processedResults
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
