import { fetchHTML, saveJobsToFirestore } from '../utils/utilities.js';
import { load } from 'cheerio';

const baseWaymoJobsUrl = 'https://careers.withwaymo.com/jobs/search';

async function fetchWaymoJobs() {
  try {
    console.log(`Starting job fetching from: ${baseWaymoJobsUrl}`);
    
    // Fetch HTML
    const html = await fetchHTML(baseWaymoJobsUrl);
    console.log('Fetched HTML successfully.');

    // Parse jobs from HTML
    const jobs = parseWaymoJobs(html);
    console.log(`Parsed ${jobs.length} jobs from Waymo listings.`);

    // Save the parsed jobs to Firestore
    await saveJobsToFirestore('waymo', jobs);

  } catch (error) {
    console.error('Error fetching jobs from Waymo:', error);
  }
}

function parseWaymoJobs(html) {
  const $ = load(html);
  const jobs = [];

  $('.job-search-results-card').each((index, element) => {
    const jobId = $(element).find('.job-component-details').attr('class').split(' ').pop();
    const title = $(element).find('.job-search-results-card-title a').text().trim();
    const link = $(element).find('.job-search-results-card-title a').attr('href');
    const summary = $(element).find('.job-search-results-summary').text().trim();
    
    jobs.push({
      jobId,
      title,
      link,
      summary,
      foundAt: new Date()
    });
  });

  return jobs;
}

export default fetchWaymoJobs;
