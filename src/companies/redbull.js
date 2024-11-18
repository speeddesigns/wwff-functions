import { load } from 'cheerio';
import { 
  fetchHTML, 
  extractJobDetails, 
  createJobFetcher,
  extractSalaryFromDisclaimer 
} from '../utils/utilities.js';
import { FIRESTORE_JOB_FIELDS } from '../utils/firestore-fields.js';

const COMPANY = 'Red Bull';
const API_URL = 'https://jobs.redbull.com/api/search?pageSize=1000000&locale=en&country=us';
const BASE_JOB_URL = 'https://jobs.redbull.com/us-en/';

// Custom Red Bull job detail extraction strategy
async function redBullJobDetailExtraction(html, url) {
  try {
    // Find the Next.js data script
    const $ = load(html);
    const nextDataScript = $('script#__NEXT_DATA__').html();
    
    if (!nextDataScript) {
      console.error('No Next.js data script found for job details');
      return null;
    }

    // Parse the JSON data
    const nextData = JSON.parse(nextDataScript);
    const jobDetails = nextData.props?.pageProps?.pageProps?.job;

    if (!jobDetails) {
      console.error('Job details not found in Next.js data');
      return null;
    }

    // Extract salary information from legal disclaimer
    const salaryInfo = extractSalaryFromDisclaimer(jobDetails.legalDisclaimer);

    // Extract and map job details
    return {
      title: jobDetails.title || '',
      description: jobDetails.description || '',
      location: jobDetails.locations ? jobDetails.locations.map(loc => loc.name).join(', ') : '',
      employmentType: jobDetails.employmentType || jobDetails.jobType || '',
      createdAt: jobDetails.createdAt || '',
      jobId: jobDetails.id ? jobDetails.id.toString() : '',
      source: jobDetails.source || '',
      slug: jobDetails.slug || '',
      ...salaryInfo  // Spread salary information
    };
  } catch (error) {
    console.error('Error parsing Red Bull job details:', error);
    return null;
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

// Create Red Bull job fetcher using the generic job fetcher
export const fetchRedBullJobs = createJobFetcher({
  company: COMPANY,
  fetchJobList: captureRedBullOpenRoles,
  extractJobDetails: (url) => extractJobDetails(url, BASE_JOB_URL, redBullJobDetailExtraction),
  baseUrl: BASE_JOB_URL
});
