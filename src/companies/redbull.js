import axios from 'axios';
import { load } from 'cheerio';

const REDBULL_API_URL = 'https://jobs.redbull.com/api/search?pageSize=1000000&locale=en&country=us';
const REDBULL_JOB_BASE_URL = 'https://jobs.redbull.com/us-en/';

export async function fetchRedbullJobs() {
  try {
    const response = await axios.get(REDBULL_API_URL);
    const { jobs } = response.data;

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

    return { jobs: formattedJobs, totalJobs: formattedJobs.length, totalPages: 1 };
  } catch (error) {
    console.error('Error fetching Redbull jobs', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

async function fetchRedbullJobDetails(slug) {
  const MAX_RETRIES = 3;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      const response = await axios.get(`${REDBULL_JOB_BASE_URL}${slug}`);
      const $ = load(response.data);
      const scriptTag = $('#__NEXT_DATA__');
      const jobData = JSON.parse(scriptTag.html());
      const job = jobData.props.pageProps.pageProps.job;

      const locations = job.locations.map(loc => loc.locationText).join('; ');
      const salary = parseSalaryFromLegalDisclaimer(job.legalDisclaimer);

      return {
        createdAt: job.createdAt,
        source: job.source,
        description: job.description,
        experiences: job.experiences,
        education: job.education,
        legalDisclaimer: job.legalDisclaimer,
        locations,
        salary
      };
    } catch (error) {
      console.error('Error fetching Redbull job details', {
        error: error.message,
        stack: error.stack
      });

      retryCount++;
      if (retryCount === MAX_RETRIES) {
        throw error;
      } else {
        console.log(`Retrying Redbull job details fetch (attempt ${retryCount}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
      }
    }
  }
}

function parseSalaryFromLegalDisclaimer(legalDisclaimer) {
  // Implement logic to parse salary information from the legal disclaimer
  // Return the parsed salary as a string
  return 'Competitive salary';
}
