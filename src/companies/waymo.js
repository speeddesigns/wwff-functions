import { load } from 'cheerio';
import { 
  fetchHTML, 
  extractJobDetails, 
  randomizedDelay, 
  createJobFetcher 
} from '../utils/utilities.js';
import { FIRESTORE_JOB_FIELDS } from '../utils/firestore-fields.js';

const baseWaymoJobsUrl = 'https://careers.withwaymo.com/jobs/search';
const COMPANY = 'Waymo';

// Minimum delay between requests to avoid bot detection
const MIN_DELAY = 30; // 30 seconds
const MAX_DELAY = 60; // 60 seconds

// Custom Waymo job detail extraction strategy
async function waymoJobDetailExtraction(html, url) {
  const $ = load(html);
  const ldJsonScript = $('script[type="application/ld+json"]').html();
  
  if (!ldJsonScript) {
    console.error('No JSON-LD script found for job details');
    return null;
  }

  try {
    const jobDetailsJson = JSON.parse(ldJsonScript);
    return {
      title: jobDetailsJson.title || '',
      description: jobDetailsJson.description || '',
      location: jobDetailsJson.jobLocation?.address?.addressLocality || '',
      employmentType: jobDetailsJson.employmentType || '',
      hiringOrganization: jobDetailsJson.hiringOrganization?.name || '',
      datePosted: jobDetailsJson.datePosted || '',
      validThrough: jobDetailsJson.validThrough || ''
    };
  } catch (error) {
    console.error('Error parsing Waymo job JSON-LD:', error);
    return null;
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

// Create Waymo job fetcher using the generic job fetcher
export const fetchWaymoJobs = createJobFetcher({
  company: COMPANY,
  fetchJobList: captureWaymoOpenRoles,
  extractJobDetails: (url) => extractJobDetails(url, baseWaymoJobsUrl, waymoJobDetailExtraction),
  baseUrl: baseWaymoJobsUrl,
  minDelay: MIN_DELAY,
  maxDelay: MAX_DELAY
});
