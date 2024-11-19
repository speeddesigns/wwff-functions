import axios from 'axios';
import { load } from 'cheerio';

const REDBULL_API_URL = 'https://jobs.redbull.com/api/search?pageSize=1000000&locale=en&country=us';
const REDBULL_JOB_BASE_URL = 'https://jobs.redbull.com/us-en/';

export async function fetchRedbullJobs() {
  console.log('Fetching Red Bull jobs...');
  try {
    const response = await axios.get(REDBULL_API_URL);
    const responseData = await response.data;
    console.log('Red Bull job count:', responseData.count);
    const jobs = responseData.jobs;

    if (!jobs) {
      console.error('Red Bull API response does not contain "jobs" property:', responseData);
      throw new Error('Red Bull API response does not contain "jobs" property');
    }

    const formattedJobs = await Promise.all(jobs.map(async job => {
      const jobDetails = await fetchRedbullJobDetails(job.slug);
      return {
        id: job.id,
        title: job.title,
        function: job.function.name,
        locationText: job.locationText,
        slug: job.slug,
        employmentType: job.employmentType,
        url: `${REDBULL_JOB_BASE_URL}${job.slug}`,
        ...jobDetails
      };
    }));

    console.log('Fetched and formatted Red Bull jobs.');
    return { jobs: formattedJobs, totalJobs: formattedJobs.length, totalPages: 1 };
  } catch (error) {
    console.error('Error fetching Red Bull jobs:', error);
    throw error;
  }
}

async function fetchRedbullJobDetails(slug) {
  // Existing code for fetchRedbullJobDetails function
}

function parseSalaryFromLegalDisclaimer(legalDisclaimer) {
  // Existing code for parseSalaryFromLegalDisclaimer function
}
