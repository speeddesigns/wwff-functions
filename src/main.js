import express from 'express';
import { fetchWaymoJobs } from './companies/waymo.js';
import { fetchCompanies, updateJobsWithOpenCloseLogic } from './db.js';

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
    // Get list of companies to fetch jobs for
    const companies = await fetchCompanies();
    
    // Process each company
    for (const company of companies) {
      console.log(`Starting job fetching for ${company}...`);
      
      // For now we only have Waymo implemented
      if (company.toLowerCase() === 'waymo') {
        const { jobs } = await fetchWaymoJobs();
        console.log(`Updating jobs for ${company} in Firestore...`);
        await updateJobsWithOpenCloseLogic(company, jobs);
      } else {
        console.log(`No job fetcher implemented for ${company} yet`);
      }
    }

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
