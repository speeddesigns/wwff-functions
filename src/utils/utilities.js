import axios from 'axios';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { fetchOpenJobs, updateJobsWithOpenCloseLogic } from '../db.js';
import { FIRESTORE_JOB_FIELDS } from '../utils/firestore-fields.js';

// Existing utilities remain the same...
// (Previous fetchHTML, extractSalaryFromDescription, randomizedDelay, extractJobDetails functions)

// Generic job fetcher creator
export async function createJobFetcher({
  company,
  fetchJobList,
  extractJobDetails,
  baseUrl,
  minDelay = 30,
  maxDelay = 60
}) {
  return async function fetchJobs() {
    console.log(`Starting ${company} job fetch at ${new Date().toISOString()}`);

    try {
      // Step 1: Get current jobs from source
      const { jobs: sourceJobs } = await fetchJobList();
      console.log(`Found ${sourceJobs.length} jobs from ${company}`);

      // Step 2: Get current jobs from Firestore
      const firestoreJobs = await fetchOpenJobs(company);
      console.log(`Found ${Object.keys(firestoreJobs).length} jobs in Firestore`);

      // Step 3: Prepare job updates
      const updates = [];
      const jobsToCheck = new Set();

      // Add or reopen jobs from source
      for (const job of sourceJobs) {
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
        await updateJobsWithOpenCloseLogic(company, updates);
        
        // Wait before proceeding to detailed checks
        await randomizedDelay(minDelay, maxDelay);
      }

      // Step 5: Concurrently fetch job details
      const jobDetailsPromises = Array.from(jobsToCheck).map(async (jobId) => {
        const job = sourceJobs.find(j => j.jobId === jobId);
        if (!job) return null;

        console.log(`Fetching details for job ${jobId}`);
        const jobDetails = await extractJobDetails(job.url, baseUrl);

        if (jobDetails) {
          return {
            ...job,
            ...jobDetails,
            jobId: job.jobId,
            [FIRESTORE_JOB_FIELDS.URL]: job.url,
            [FIRESTORE_JOB_FIELDS.TITLE]: jobDetails.title || job[FIRESTORE_JOB_FIELDS.TITLE],
            [FIRESTORE_JOB_FIELDS.LOCATION]: jobDetails.location,
            [FIRESTORE_JOB_FIELDS.EMPLOYMENT_TYPE]: jobDetails.employmentType,
            [FIRESTORE_JOB_FIELDS.COMP_START_RANGE]: jobDetails.compStart,
            [FIRESTORE_JOB_FIELDS.COMP_MID_RANGE]: jobDetails.compMid,
            [FIRESTORE_JOB_FIELDS.COMP_END_RANGE]: jobDetails.compEnd
          };
        }
        return null;
      });

      // Wait for all job details to be fetched
      const jobDetailsResults = await Promise.all(jobDetailsPromises);
      const validJobDetails = jobDetailsResults.filter(job => job !== null);

      // Update Firestore with detailed job information
      if (validJobDetails.length > 0) {
        console.log(`Updating ${validJobDetails.length} jobs with detailed information`);
        await updateJobsWithOpenCloseLogic(company, validJobDetails);
      }

      console.log('Job fetching and updating complete');
      return { jobs: sourceJobs, company };

    } catch (error) {
      console.error(`Error during ${company} job processing:`, error);
      throw error;
    }
  };
}

// Salary extraction utility for legal disclaimers
export function extractSalaryFromDisclaimer(disclaimer, currencySymbol = '$') {
  if (!disclaimer) return null;

  // Regex to match salary range pattern with configurable currency symbol
  const salaryRegex = new RegExp(`\\${currencySymbol}(\\d{1,3}(?:,\\d{3})*)\s*–\s*\\${currencySymbol}(\\d{1,3}(?:,\\d{3})*)`);
  const match = disclaimer.match(salaryRegex);

  if (!match) return null;

  // Parse and clean salary values
  const minSalary = parseFloat(match[1].replace(/,/g, ''));
  const maxSalary = parseFloat(match[2].replace(/,/g, ''));

  return {
    compStart: minSalary,
    compMid: (minSalary + maxSalary) / 2,
    compEnd: maxSalary
  };
}

export default {
  fetchHTML,
  extractSalaryFromDescription,
  randomizedDelay,
  extractJobDetails,
  createJobFetcher,
  extractSalaryFromDisclaimer
};
