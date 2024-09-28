import { load } from 'cheerio';
import { fetchHTML, extractSalaryFromDescription, saveJobsToFirestore } from '../utils/utilities.js';

const baseWaymoJobsUrl = 'https://careers.withwaymo.com/jobs/search';

async function fetchWaymoJobs() {
  try {
    console.log(`Starting job fetching from: ${baseWaymoJobsUrl}`);
    
    // Fetch the first page with headers
    const firstPageHtml = await fetchHTML(baseWaymoJobsUrl);
    console.log('Fetched first page HTML successfully.');

    // Extract total number of jobs and jobs per page from pagination
    const { totalJobs, jobsPerPage } = getPaginationInfo(firstPageHtml);
    console.log(`Total jobs: ${totalJobs}, Jobs per page: ${jobsPerPage}`);

    // Calculate the number of pages to fetch
    const totalPages = Math.ceil(totalJobs / jobsPerPage);
    console.log(`Total pages to fetch: ${totalPages}`);

    let allJobs = [];
    for (let page = 1; page <= totalPages; page++) {
      console.log(`Fetching jobs from page ${page}...`);
      const pageUrl = `${baseWaymoJobsUrl}?page=${page}`;
      const pageHtml = await fetchHTML(pageUrl);

      // Parse jobs from HTML
      const jobs = parseWaymoJobs(pageHtml);
      console.log(`Parsed ${jobs.length} jobs from page ${page}.`);

      // Fetch additional details for all jobs in parallel
      const jobDetailsPromises = jobs.map(async (job) => {
        try {
          const jobDetails = await fetchJobDetails(job.link);  // Fetch extra job details
          
          // Merge job summary info with details
          return { ...job, ...jobDetails };
        } catch (error) {
          console.error(`Error fetching details for job ${job.title}:`, error);
          return null;  // Skip this job if details fetch fails
        }
      });

      // Wait for all job details to be fetched
      const detailedJobs = await Promise.all(jobDetailsPromises);

      // Filter out any failed jobs (nulls)
      const validJobs = detailedJobs.filter(job => job !== null);

      // Add valid jobs to allJobs
      allJobs = allJobs.concat(validJobs);
    }

    console.log(`Total jobs fetched: ${allJobs.length}`);
    
    // Save the parsed jobs to Firestore
    await saveJobsToFirestore('Waymo', allJobs);

  } catch (error) {
    console.error('Error fetching jobs from Waymo:', error);
    throw error;  // Rethrow the error to let the caller handle it
  }
}

// Helper function to extract pagination info
function getPaginationInfo(html) {
  const $ = load(html);
  const totalJobsText = $('.table-counts').text();
  const totalJobsMatch = totalJobsText.match(/of\s+(\d+)\s+in/); // Extract total jobs
  const jobsPerPageMatch = totalJobsText.match(/Displaying\s+(\d+)\s+&ndash;/); // Extract jobs per page

  const totalJobs = totalJobsMatch ? parseInt(totalJobsMatch[1], 10) : 0;
  const jobsPerPage = jobsPerPageMatch ? parseInt(jobsPerPageMatch[1], 10) : 30; // Default to 30 if not found

  return { totalJobs, jobsPerPage };
}

async function fetchJobDetails(jobUrl) {
  console.log(`Fetching job details from: ${jobUrl}`);
  const jobHtml = await fetchHTML(jobUrl);  // Fetch the HTML of the job page
  const jobDetailsJson = parseJobJsonLd(jobHtml);  // Extract the JSON-LD data

  // Extract salary info from the description
  const salaryData = extractSalaryFromDescription(jobDetailsJson.description);
  jobDetailsJson.salary = salaryData;

  console.log(`Extracted job details: ${JSON.stringify(jobDetailsJson)}`);
  return jobDetailsJson;  // Return the detailed job data
}

export default fetchWaymoJobs;