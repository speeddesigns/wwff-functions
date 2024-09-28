import { load } from 'cheerio';
import { fetchHTML, extractSalaryFromDescription } from '../utils/utilities.js';
import {  saveJobsToFirestore } from '../db.js';

const baseWaymoJobsUrl = 'https://careers.withwaymo.com/jobs/search';

// Fetch job listings from Waymo
async function fetchWaymoJobs() {
  try {
    let allJobs = [];
    let page = 1;
    let totalPages = 1; // Start with the assumption there is at least one page

    while (page <= totalPages) {
      const pageUrl = `${baseWaymoJobsUrl}?page=${page}`;
      console.log(`Fetching jobs from page ${page}...`);
      
      const pageHtml = await fetchHTML(pageUrl);
      console.log(`Fetched HTML for page ${page}.`);

      // Parse jobs from the current page
      const jobs = parseWaymoJobs(pageHtml);
      console.log(`Parsed ${jobs.length} jobs from page ${page}.`);

      // Fetch additional details for each job
      for (const job of jobs) {
        const jobDetails = await fetchJobDetails(job.link);
        allJobs.push({ ...job, ...jobDetails });
      }

      // Extract pagination info on the first pass
      if (page === 1) {
        const { totalJobs, jobsPerPage } = getPaginationInfo(pageHtml);
        totalPages = Math.ceil(totalJobs / jobsPerPage);
        console.log(`Total jobs: ${totalJobs}, Jobs per page: ${jobsPerPage}, Total pages: ${totalPages}`);
      }

      // Move to the next page
      page++;
    }

    // Save all fetched jobs to Firestore
    await saveJobsToFirestore('Waymo', allJobs);
    console.log('Finished fetching and saving jobs from Waymo.');
  } catch (error) {
    console.error('Error fetching jobs from Waymo:', error);
  }
}

// Extract pagination information from the HTML
function getPaginationInfo(html) {
  const $ = load(html);
  const totalJobsText = $('.table-counts').text();
  const totalJobsMatch = totalJobsText.match(/of\s+(\d+)\s+in/);
  const jobsPerPageMatch = totalJobsText.match(/Displaying\s+(\d+)\s+&ndash;/);

  const totalJobs = totalJobsMatch ? parseInt(totalJobsMatch[1], 10) : 0;
  const jobsPerPage = jobsPerPageMatch ? parseInt(jobsPerPageMatch[1], 10) : 30;
  
  return { totalJobs, jobsPerPage };
}

// Parse job listings from a page's HTML
function parseWaymoJobs(html) {
  const $ = load(html);
  const jobs = [];

  $('.job-search-results-card').each((index, element) => {
    const jobId = $(element).find('.job-component-details').attr('class').split('-').pop();
    const title = $(element).find('.job-search-results-card-title a').text().trim();
    const link = $(element).find('.job-search-results-card-title a').attr('href');

    jobs.push({ jobId, title, link });
  });

  return jobs;
}

// Fetch individual job details from job page
async function fetchJobDetails(jobUrl) {
  const jobHtml = await fetchHTML(jobUrl);
  const jobDetailsJson = parseJobJsonLd(jobHtml);

  const salaryData = extractSalaryFromDescription(jobDetailsJson.description);
  jobDetailsJson.salary = salaryData;

  return jobDetailsJson;
}

// Parse JSON-LD data from job page
function parseJobJsonLd(html) {
  const $ = load(html);
  const ldJsonScript = $('script[type="application/ld+json"]').html();
  return JSON.parse(ldJsonScript);
}

export default fetchWaymoJobs;
