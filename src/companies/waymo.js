import { load } from 'cheerio';
import { fetchHTML, extractSalaryFromDescription, randomizedDelay } from '../utils/utilities.js';
import { updateJobsWithOpenCloseLogic,fetchJobFromDB, updateJobDetails  } from '../db.js';  // Updated to match the correct function

const baseWaymoJobsUrl = 'https://careers.withwaymo.com/jobs/search';
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const BUFFER_TIME_IN_MS = 60 * 60 * 1000; // 1 hour buffer time in milliseconds

// Fetch job listings from Waymo once a day, timestamp the start, and distribute job detail fetching over the day
export async function fetchWaymoJobs() {
  const scriptStartTime = new Date();
  console.log(`Script started at ${scriptStartTime.toISOString()}`);

  try {
    // Step 1: Capture open roles
    const jobData = await captureWaymoOpenRoles();
    const openRoles = jobData.jobs;
    const numOpenRoles = openRoles.length;

    console.log(`Captured ${numOpenRoles} open roles for Waymo.`);

    // Step 2: Update database with new roles and close any missing jobs
    await updateJobsWithOpenCloseLogic(openRoles);  // Implemented in db.js

    // Step 3: Calculate time left for job detail fetching
    const timeLeftInDay = ONE_DAY_IN_MS - (new Date() - scriptStartTime) - BUFFER_TIME_IN_MS;
    const interval = Math.floor(timeLeftInDay / numOpenRoles);

    console.log(`Calculated base interval of ${interval / 1000} seconds per job detail retrieval.`);

    // Step 4: Fetch details for each job one by one and update if necessary
    for (let i = 0; i < numOpenRoles; i++) {
      const job = openRoles[i];

      // Fetch details for this job
      console.log(`Fetching details for job ${job.jobId}: ${job.title}`);
      const jobDetails = await fetchJobDetails(job.link);

      if (jobDetails && typeof jobDetails === 'object') {
        console.log(`Checking if details for job ${job.jobId} need updating...`);
        
        // Check if the details in the database differ from what we fetched
        const existingJob = await fetchJobFromDB('Waymo', job.jobId);  // Get job from database (implement in db.js)
        
        if (JSON.stringify(existingJob) !== JSON.stringify(jobDetails)) {
          console.log(`Updating details for job ${job.jobId}: ${job.title}`);
          await updateJobDetails('Waymo', job.jobId, jobDetails);  // Update the database with new details
        } else {
          console.log(`Details for job ${job.jobId} are already up to date.`);
        }
      } else {
        console.log(`Skipping job ${job.jobId} due to invalid details.`);
      }

      // Randomized delay before fetching the next job's details
      const twoMin = 2*60*1000;
      const minDelay = interval - twoMin;
      const maxDelay = interval + twoMin;

      console.log(`Waiting for a randomized delay between ${minDelay / 1000} and ${maxDelay / 1000} seconds...`);
      await randomizedDelay(minDelay / 1000, maxDelay / 1000); // Convert ms to seconds
    }

  } catch (error) {
    console.error('Error during Waymo job capture:', error);
    throw error;
  }

  // Step 5: Buffer before the next run
  console.log(`Execution completed. Sleeping until the next scheduled run...`);
  await sleepUntilNextRun('00:00'); // Sleep until midnight for the next run
}

// Function to capture open roles
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
      await randomizedDelay(5, 10);
    }

    return { jobs: allJobs, company: 'Waymo' };

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
  const jobsPerPage = 30; // Assuming it's always 30, unless it changes

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
    const link = $(element).find('.job-search-results-card-title a').attr('href');

    jobs.push({ jobId, title, link });
    console.log(`Parsed job ${jobId}: ${title}, ${link}`)
  });

  return jobs;
}

// Fetch individual job details from job page
async function fetchJobDetails(jobUrl) {
  const jobHtml = await fetchHTML(jobUrl, baseWaymoJobsUrl,true);
  console.log(jobHtml);  // Print the full HTML to inspect

  const jobDetailsJson = parseJobJsonLd(jobHtml);
  console.log(jobDetailsJson);  // Log the extracted JSON-LD

  if (!jobDetailsJson || !jobDetailsJson.description) {
    console.error('Job details JSON or description is missing');
    return null;
  }

  const salaryData = extractSalaryFromDescription(jobDetailsJson.description);
  jobDetailsJson.salary = salaryData;
  console.log(jobDetailsJson.salary);

  return jobDetailsJson;
}

// Parse JSON-LD data from job page
function parseJobJsonLd(html) {
  const $ = load(html);
  const ldJsonScript = $('script[type="application/ld+json"]').html();
  return JSON.parse(ldJsonScript);
}