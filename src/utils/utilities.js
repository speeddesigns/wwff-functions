const { get } = require('https');
const { load } = require('cheerio');
const { saveJobs } = require('./db');

// Fetch HTML
function fetchHTML(url) {
  console.log(`Fetching HTML from ${url}`);
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        console.log('HTML fetching completed.');
        resolve(data);
      });
      response.on('error', err => {
        console.error('Error fetching HTML:', err);
        reject(err);
      });
    });
  });
}

// Save jobs to Firestore
async function saveJobsToFirestore(company, jobs) {
  console.log(`Saving jobs for ${company}...`);
  await saveJobs(company, jobs);
}

module.exports = { fetchHTML, saveJobsToFirestore };
