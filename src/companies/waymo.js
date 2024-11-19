import axios from 'axios';
import { load } from 'cheerio';

const MIN_DELAY = 1000; // 1 second
const MAX_DELAY = 3000; // 3 seconds

// Randomized delay to avoid rate limiting
function randomizedDelay(min, max) {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay);
  });
}

export async function fetchWaymoJobs() {
  try {
    const baseUrl = 'https://waymo.com/careers/';
    const jobsPerPage = 10;
    let page = 1;
    let totalJobs = 0;
    const jobs = [];

    while (true) {
      const pageUrl = `${baseUrl}?page=${page}`;
      logger.info(`Fetching jobs from ${pageUrl}`);

      const response = await axios.get(pageUrl);
      const pageHtml = response.data;

      const parsedJobs = parseWaymoJobs(pageHtml);
      
      if (parsedJobs.length === 0) break;

      jobs.push(...parsedJobs);
      totalJobs += parsedJobs.length;

      logger.info(`Parsed ${parsedJobs.length} jobs from page ${page}`);

      // Add delay between page fetches
      logger.debug('Waiting before fetching next page...');
      await randomizedDelay(MIN_DELAY, MAX_DELAY);

      page++;
    }

    const totalPages = Math.ceil(totalJobs / jobsPerPage);
    logger.info(`Total jobs: ${totalJobs}, jobs per page: ${jobsPerPage}, total pages: ${totalPages}`);

    return { jobs, totalJobs, totalPages };
  } catch (error) {
    logger.error('Error fetching Waymo jobs', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

function parseWaymoJobs(html) {
  logger.debug('Parsing jobs...');
  const $ = load(html);
  const jobs = [];

  $('.job-listing').each((index, element) => {
    const title = $(element).find('.job-title').text().trim();
    const url = $(element).find('a.job-link').attr('href');
    const jobId = url.split('/').pop();
    const location = $(element).find('.job-location').text().trim();
    const department = $(element).find('.job-department').text().trim();

    if (title && url) {
      const job = {
        jobId,
        title,
        url: `https://waymo.com${url}`,
        location,
        department,
        company: 'Waymo'
      };

      jobs.push(job);
      logger.debug(`Parsed job ${jobId}: ${title}, ${url}`);
    }
  });

  return jobs;
}
