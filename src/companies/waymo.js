console.log('Executing src/companies/waymo.js');

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
  console.log('Executing fetchWaymoJobs');
  try {
    const baseUrl = 'https://careers.withwaymo.com/jobs/search';
    const jobsPerPage = 10;
    let page = 1;
    let totalJobs = 0;
    const jobs = [];

    while (true) {
      const pageUrl = `${baseUrl}?page=${page}`;
      console.log(`Fetching jobs from ${pageUrl}`);

      const response = await axios.get(pageUrl);
      const pageHtml = response.data;



      const parsedJobs = await parseWaymoJobs(pageHtml);
      
      if (parsedJobs.length === 0) break;

      jobs.push(...parsedJobs);
      totalJobs += parsedJobs.length;

      console.log(`Parsed ${parsedJobs.length} jobs from page ${page}`);

      // Add delay between page fetches
      console.log('Waiting before fetching next page...');
      await randomizedDelay(MIN_DELAY, MAX_DELAY);

      page++;
    }

    const totalPages = Math.ceil(totalJobs / jobsPerPage);
    console.log(`Total jobs: ${totalJobs}, jobs per page: ${jobsPerPage}, total pages: ${totalPages}`);
    console.log('Finished executing fetchWaymoJobs');

    return { jobs, totalJobs, totalPages };
  } catch (error) {
    console.error('Error fetching Waymo jobs', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

async function parseWaymoJobs(html) {
  console.log('Executing parseWaymoJobs');
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
      console.log(`Parsed job ${jobId}: ${title}, ${url}`);
    } else {
      console.error(`Error parsing job from element: ${$(element).html()}`);
    }
  });

  console.log('Finished executing parseWaymoJobs');
  return jobs;
}
