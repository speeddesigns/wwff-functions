import { fetchOpenJobs, updateJobsWithOpenCloseLogic } from '../db.js';
import { FIRESTORE_JOB_FIELDS } from '../utils/firestore-fields.js';
import { randomizedDelay } from '../utils/utilities.js';

const COMPANY = 'Red Bull';
const API_URL = 'https://jobs.redbull.com/api/search?pageSize=1000000&locale=en&country=us';
const BASE_JOB_URL = 'https://jobs.redbull.com/us-en/';

// Minimum delay between requests to avoid bot detection
const MIN_DELAY = 30; // 30 seconds
const MAX_DELAY = 60; // 60 seconds

// Fetch job listings from Red Bull
export async function fetchRedBullJobs() {
  console.log(`Starting Red Bull job fetch at ${new Date().toISOString()}`);

  try {
    // Step 1: Get current jobs from Red Bull's API
    const { jobs: apiJobs } = await captureRedBullOpenRoles();
    console.log(`Found ${apiJobs.length} jobs from Red Bull API`);

    // Step 2: Get current jobs from Firestore
    const firestoreJobs = await fetchOpenJobs(COMPANY);
    console.log(`Found ${Object.keys(firestoreJobs).length} jobs in Firestore`);

    // Step 3: Compare lists and prepare updates
    const updates = [];
    const jobsToCheck = new Set();

    // Add or reopen jobs from API
    for (const job of apiJobs) {
      const existingJob = firestoreJobs[job.jobId];
      if (!existingJob) {
        // New job
        updates.push({
          ...job,
          [FIRESTORE_JOB_FIELDS.OPEN_STATUS]: true,
          [FIRESTORE_JOB_FIELDS.FOUND_DATE]: new Date().toISOString(),
          isNew: true
        });
      } else if (!existingJob[FIRESTORE_JOB_FIELDS.OPEN_STATUS]) {
        // Existing job that needs to be reopened
        updates.push({
          ...existingJob,
          ...job,
          [FIRESTORE_JOB_FIELDS.OPEN_STATUS]: true,
          reopened: true
        });
      }
      jobsToCheck.add(job.jobId);
    }

    // Step 4: Update Firestore with new and reopened jobs
    if (updates.length > 0) {
      console.log(`Updating ${updates.length} jobs in Firestore`);
      await updateJobsWithOpenCloseLogic(COMPANY, updates);
      
      // Wait before proceeding to detailed checks
      console.log('Waiting before checking job details...');
      await randomizedDelay(MIN_DELAY, MAX_DELAY);
    }

    console.log('Job fetching and updating complete');
    return { jobs: apiJobs, company: COMPANY };

  } catch (error) {
    console.error('Error during Red Bull job processing:', error);
    throw error;
  }
}

// Function to capture open roles from Red Bull's API
async function captureRedBullOpenRoles() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Transform jobs to match expected format
    const jobs = data.jobs.map(job => ({
      jobId: job.id.toString(),
      [FIRESTORE_JOB_FIELDS.TITLE]: job.title,
      [FIRESTORE_JOB_FIELDS.URL]: `${BASE_JOB_URL}${job.slug}`,
      [FIRESTORE_JOB_FIELDS.EMPLOYMENT_TYPE]: job.employmentType,
      [FIRESTORE_JOB_FIELDS.LOCATION]: job.locationText
    }));

    return { jobs, company: COMPANY };

  } catch (error) {
    console.error('Error fetching jobs from Red Bull:', error);
    throw error;
  }
}
