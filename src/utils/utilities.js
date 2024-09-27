import { get } from 'https';
import { load } from 'cheerio';
import { saveJobs } from '../db.js';

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

export default { fetchHTML, saveJobsToFirestore };
