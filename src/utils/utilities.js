import { get } from 'https';
import { load } from 'cheerio';
import { db } from '../db.js';
import { collection, doc, setDoc } from 'firebase/firestore'; // Firebase Firestore methods

// Fetch HTML with headers (to mimic a browser request)
export function fetchHTML(url) {   
  console.log(`Fetching HTML from ${url}`);
  
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',  // Mimic a real browser
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    }
  };

  return new Promise((resolve, reject) => {
    get(url, options, (response) => {
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

// Regex to capture salary information in various formats
const salaryRegex = /\₹?[\d,.]+(?:\s?[kK]?\s?-\s?\₹?[\d,.]+\s?[kK]?)?/g;

// Extract salary details from job description
export function extractSalaryFromDescription(description) {
  console.log('Extracting salary details...');
  const matches = description.match(salaryRegex);

  if (!matches) {
    console.log('No salary information found.');
    return null;  // No salary info found
  }

  const salaries = matches.map(s => parseFloat(s.replace(/[^0-9.]/g, '')));
  if (salaries.length === 1) {
    return { min: salaries[0], max: salaries[0], mid: salaries[0] };
  } else {
    const min = Math.min(...salaries);
    const max = Math.max(...salaries);
    const mid = (min + max) / 2;
    return { min, max, mid };
  }
}

// Save jobs to Firestore
export async function saveJobsToFirestore(company, jobs) {   
  console.log(`Saving jobs for ${company}...`);

  const collectionRef = collection(db, company); // Reference to the company-specific Firestore collection

  for (const job of jobs) {
    try {
      const jobDocRef = doc(collectionRef, job.jobId);  // Use jobId as the document ID

      // Construct the job data object dynamically, adding only available fields
      const jobData = {};

      if (job.title) jobData.title = job.title;
      if (job.description) jobData.description = job.description;  // If description exists
      if (job.datePosted) jobData.datePosted = job.datePosted;  // If datePosted exists
      if (job.employmentType) jobData.employmentType = job.employmentType;  // If employmentType exists
      if (job.validThrough) jobData.validThrough = job.validThrough;  // If validThrough exists
      if (job.hiringOrganization && job.hiringOrganization.name) {
        jobData.hiringOrganizationName = job.hiringOrganization.name;  // If hiring organization name exists
      }
      if (job.jobLocation && job.jobLocation.length) {
        jobData.jobLocation = job.jobLocation;  // If jobLocation array exists and is not empty
      }
      jobData.foundAt = new Date();  // Always record when the job was found

      // Set the job document without any missing fields
      await setDoc(jobDocRef, jobData, { merge: true });
      console.log(`Job ${job.jobId} saved successfully.`);
    } catch (error) {
      console.error(`Error saving job ${job.jobId}:`, error);
    }
  }
  
  console.log(`Finished saving jobs for ${company}`);
}