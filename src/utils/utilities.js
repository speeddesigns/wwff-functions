import axios from 'axios';
import logger from './logger.js';
import { fetchOpenJobs, updateJobsWithOpenCloseLogic } from '../db.js';

// Utility function to fetch job details from a given URL
export async function extractJobDetails(url, baseUrl) {
  try {
    logger.debug(`Fetching job details from ${url}`);
    const response = await axios.get(url);
    // Implement job details extraction logic here
    // This is a placeholder and should be replaced with actual implementation
    return {
      url,
      // Add extracted job details
    };
  } catch (error) {
    logger.error(`Error fetching job details from ${url}`, {
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}

// Utility function to fetch and process jobs for a specific company
export async function processCompanyJobs(company, fetchJobList, baseUrl) {
  try {
    logger.info(`Starting ${company} job fetch`, { 
      timestamp: new Date().toISOString() 
    });

    const { jobs: sourceJobs } = await fetchJobList();
    logger.info(`Found ${sourceJobs.length} jobs from ${company}`);

    const firestoreJobs = await fetchOpenJobs(company);
    logger.info(`Found ${Object.keys(firestoreJobs).length} jobs in Firestore`);

    const updates = [];
    const validJobDetails = [];

    for (const job of sourceJobs) {
      const existingJob = firestoreJobs[job.jobId];

      if (!existingJob) {
        updates.push(job);
      } else if (checkIfJobChanged(existingJob, job)) {
        updates.push(job);
      }

      // Fetch additional job details if needed
      if (job.url) {
        logger.debug(`Fetching details for job ${job.jobId}`);
        const jobDetails = await extractJobDetails(job.url, baseUrl);
        
        if (jobDetails) {
          validJobDetails.push(jobDetails);
        }
      }
    }

    if (updates.length > 0) {
      logger.info(`Updating ${updates.length} jobs in Firestore`);
      await updateJobsWithOpenCloseLogic(company, updates);
    }

    if (validJobDetails.length > 0) {
      logger.info(`Updating ${validJobDetails.length} jobs with detailed information`);
      await updateJobsWithOpenCloseLogic(company, validJobDetails);
    }

    logger.info('Job fetching and updating complete');
    return { jobs: sourceJobs, company };
  } catch (error) {
    logger.error(`Error processing jobs for ${company}`, {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Check if job details have changed
function checkIfJobChanged(existingJob, newJob) {
  const fieldsToCompare = [
    'title',
    'url',
    'description',
    'location',
    'employmentType',
    'datePosted',
    'validThrough',
    'hiringOrganization',
    'jobFamily',
    'department',
    'compStart',
    'compMid',
    'compEnd'
  ];

  return fieldsToCompare.some(field => {
    if (typeof existingJob[field] === 'object' && typeof newJob[field] === 'object') {
      return JSON.stringify(existingJob[field]) !== JSON.stringify(newJob[field]);
    }
    return existingJob[field] !== newJob[field];
  });
}
