//Waymo uses clinchtalent as of mid-2024

const https = require('https');
const cheerio = require('cheerio');
const { saveJobs } = require('../db');

// Base URL for Waymo job listings
const baseWaymoJobsUrl = 'https://careers.withwaymo.com/jobs/search';

async function fetchWaymoJobs() {
  const html = await fetchHTML(baseWaymoJobsUrl);
  const jobs = parseWaymoJobs(html);
  
  // Save the parsed jobs to Firestore
  await saveJobs('waymo', jobs);
}

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
      response.on('error', err => reject(err));
    });
  });
}

function parseWaymoJobs(html) {
  const $ = cheerio.load(html);
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

module.exports = fetchWaymoJobs;