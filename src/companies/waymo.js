import { load } from 'cheerio';
import { fetchHTML, extractSalaryFromDescription, randomizedDelay } from '../utils/utilities.js';

const baseWaymoJobsUrl = 'https://careers.withwaymo.com/jobs/search';

// Fetch job listings from Waymo
export async function fetchWaymoJobs() {

  try {

    let allJobs = [];
    let page = 1;

    while (true) {
      const pageUrl = `${baseWaymoJobsUrl}?page=${page}`;
      console.log(`Fetching jobs from ${pageUrl}...`);

      const pageHtml = await fetchHTML(pageUrl, baseWaymoJobsUrl);
      const jobs = parseWaymoJobs(pageHtml);
      console.log(`Parsed ${jobs.length} jobs from page ${page}.`);

      for (const job of jobs) {
        const jobDetails = await fetchJobDetails(job.link);

        // Check if jobDetails is valid before pushing
        if (jobDetails && typeof jobDetails === 'object') {
          allJobs.push({ ...job, ...jobDetails });
          console.log(`Added job ${job.jobId}: ${job.title}`);
        } else {
          console.log(`Skipping job ${job.jobId} due to invalid details.`);
        }

        await randomizedDelay(10,30);
      }


      // Check if there are more pages
      const { totalPages } = getPaginationInfo(pageHtml);
      if (page >= totalPages) break;
      page++;
      await randomizedDelay(10,30);
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
  const totalJobsText = $('.table-counts').text();
  const totalJobsMatch = totalJobsText.match(/of\s+(\d+)\s+in/);
  const jobsPerPageMatch = totalJobsText.match(/Displaying\s+(\d+)\s+&ndash;/);

  const totalJobs = totalJobsMatch ? parseInt(totalJobsMatch[1], 10) : 0;
  const jobsPerPage = jobsPerPageMatch ? parseInt(jobsPerPageMatch[1], 10) : 30;

  const totalPages = Math.ceil(totalJobs / jobsPerPage);
  return { totalJobs, jobsPerPage, totalPages };
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