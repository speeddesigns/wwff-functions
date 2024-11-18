import { load } from 'cheerio';
import { fetchHTML, extractSalaryFromDescription, randomizedDelay } from '../utils/utilities.js';
import { fetchOpenJobs, updateJobsWithOpenCloseLogic } from '../db.js';
import { FIRESTORE_JOB_FIELDS } from '../utils/firestore-fields.js';

const baseWaymoJobsUrl = 'https://careers.withwaymo.com/jobs/search';
const COMPANY = 'Waymo';

// Minimum delay between requests to avoid bot detection
const MIN_DELAY = 30; // 30 seconds
const MAX_DELAY = 60; // 60 seconds

// Fetch job listings from Waymo
export async function fetchWaymoJobs() {
  console.log(`Starting Waymo job fetch at ${new Date().toISOString()}`);

  try {
    // Step 1: Get current jobs from Waymo's website
    const { jobs: websiteJobs } = await captureWaymoOpenRoles();
    console.log(`Found ${websiteJobs.length} jobs on Waymo's website`);

    // Step 2: Get current jobs from Firestore
    const firestoreJobs = await fetchOpenJobs(COMPANY);
    console.log(`Found ${Object.keys(firestoreJobs).length} jobs in Firestore`);

    // Step 3: Compare lists and prepare updates
    const updates = [];
    const jobsToCheck = new Set();

    // Add or reopen jobs from website
    for (const job of websiteJobs) {
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

    // Step 5: Check each job's details one by one with delays
    console.log('Starting detailed job checks...');
    for (const jobId of jobsToCheck) {
      const job = websiteJobs.find(j => j.jobId === jobId);
      if (!job) continue;

      console.log(`Checking details for job ${jobId}`);
      const jobDetails = await fetchJobDetails(job.url);

      if (jobDetails && typeof jobDetails === 'object') {
        const updatedJob = {
          ...job,
          ...jobDetails,
          jobId: job.jobId,
          [FIRESTORE_JOB_FIELDS.URL]: job.url,
          [FIRESTORE_JOB_FIELDS.COMP_START_RANGE]: jobDetails.compStart,
          [FIRESTORE_JOB_FIELDS.COMP_MID_RANGE]: jobDetails.compMid,
          [FIRESTORE_JOB_FIELDS.COMP_END_RANGE]: jobDetails.compEnd
        };
        
        // Update if details have changed
        await updateJobsWithOpenCloseLogic(COMPANY, [updatedJob]);
      }

      // Add delay between job detail checks
      if (jobsToCheck.size > 1) {
        console.log('Waiting before next job check...');
        await randomizedDelay(MIN_DELAY, MAX_DELAY);
      }
    }

    console.log('Job fetching and updating complete');
    return { jobs: websiteJobs, company: COMPANY };

  } catch (error) {
    console.error('Error during Waymo job processing:', error);
    throw error;
  }
}

// Function to capture open roles from Waymo's website
async function captureWaymoOpenRoles() {
  try {
    let allJobs = [];
    let page = 1;

    while (true) {
      const pageUrl = `${baseWaymoJobsUrl}?page=${page}`;
      console.log(`Fetching jobs from ${pageUrl}...`);

      const pageHtml = await fetchHTML(pageUrl, baseWaymoJobsUrl);
      const jobs = parseWaymoJobs(pageHtml);
      console.log(`Parsed ${jobs.length} jobs from page ${page}.`);

      allJobs.push(...jobs);

      // Check if there are more pages
      const { totalPages } = getPaginationInfo(pageHtml);
      if (page >= totalPages) break;
      
      page++;
      // Add delay between page fetches
      console.log('Waiting before fetching next page...');
      await randomizedDelay(MIN_DELAY, MAX_DELAY);
    }

    return { jobs: allJobs, company: COMPANY };

  } catch (error) {
    console.error('Error fetching jobs from Waymo:', error);
    throw error;
  }
}

// Helper function to extract pagination info
function getPaginationInfo(html) {
  const $ = load(html);
  const totalJobsText = $('.table-counts').text().trim();

  // Extract the total number of jobs from the text
  const totalJobsMatch = totalJobsText.match(/of\s+(\d+)\s+in\s+total/);
  const totalJobs = totalJobsMatch ? parseInt(totalJobsMatch[1], 10) : 0;

  // Calculate the number of jobs per page (usually 30)
  const jobsPerPage = 30;

  const totalPages = Math.ceil(totalJobs / jobsPerPage);
  console.log(`Total jobs: ${totalJobs}, jobs per page: ${jobsPerPage}, total pages: ${totalPages}`);
  return { totalJobs, totalPages };
}

// Parse job listings from a page's HTML
function parseWaymoJobs(html) {
  console.log(`Parsing jobs...`)
  const $ = load(html);
  const jobs = [];

  $('.job-search-results-card').each((index, element) => {
    const jobId = $(element).find('.job-component-details').attr('class').split('-').pop();
    const title = $(element).find('.job-search-results-card-title a').text().trim();
    const url = $(element).find('.job-search-results-card-title a').attr('href');

    jobs.push({ 
      jobId, 
      [FIRESTORE_JOB_FIELDS.TITLE]: title, 
      [FIRESTORE_JOB_FIELDS.URL]: url 
    });
    console.log(`Parsed job ${jobId}: ${title}, ${url}`)
  });

  return jobs;
}

// Fetch individual job details from job page
async function fetchJobDetails(jobUrl) {
  const jobHtml = await fetchHTML(jobUrl, baseWaymoJobsUrl, true);

  const jobDetailsJson = parseJobJsonLd(jobHtml);
  console.log(jobDetailsJson);

  if (!jobDetailsJson || !jobDetailsJson.description) {
    console.error('Job details JSON or description is missing');
    return null;
  }

  return jobDetailsJson;
}

// Parse JSON-LD data from job page
function parseJobJsonLd(html) {
  const $ = load(html);
  const ldJsonScript = $('script[type="application/ld+json"]').html();
  return JSON.parse(ldJsonScript);
}
