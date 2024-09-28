import { fetchHTML, saveJobsToFirestore } from '../utils/utilities.js';
import { load } from 'cheerio';

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

      // Add parsed jobs to the allJobs array
      allJobs = allJobs.concat(jobs);
    }

    console.log(`Total jobs fetched: ${allJobs.length}`);

    // Save the parsed jobs to Firestore
    await saveJobsToFirestore('Waymo', allJobs);

  } catch (error) {
    console.error('Error fetching jobs from Waymo:', error);
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

function parseWaymoJobs(html) {
  const $ = load(html);
  const jobs = [];

  console.log('Parsing HTML for jobs...');
  
  $('.job-search-results-card').each((index, element) => {
    const classList = $(element).find('.job-component-details').attr('class').split(' ');
    const jobId = classList.pop().split('-').pop(); // Extract just the job ID
  
    const title = $(element).find('.job-search-results-card-title a').text().trim();
    const link = $(element).find('.job-search-results-card-title a').attr('href');
    
    jobs.push({
      jobId,
      title,
      link,
      foundAt: new Date(),
    });
  });
  

  console.log(`Found ${jobs.length} jobs on this page.`);
  return jobs;
}

export default fetchWaymoJobs;