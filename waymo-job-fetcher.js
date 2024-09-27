const https = require('https');
const cheerio = require('cheerio'); // For HTML parsing
const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore();

// Base URL for Waymo job listings
const baseWaymoJobsUrl = 'https://careers.withwaymo.com/jobs/search';

// Function to fetch the HTML of a specific page using Node's https module
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';

      // Collect the response data chunks
      response.on('data', (chunk) => {
        data += chunk;
      });

      // On completion of data retrieval
      response.on('end', () => {
        if (response.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Failed to fetch page: ${response.statusCode}`));
        }
      });
    }).on('error', reject); // Simplified error handling
  });
}

// Function to fetch jobs from a specific page and return the pagination info
async function fetchWaymoJobs(page = 1) {
  const url = `${baseWaymoJobsUrl}?page=${page}`;
  console.log(`Fetching jobs from: ${url}`);
  
  try {
    // Fetch the HTML using Node's https module
    const html = await fetchHTML(url);

    // Parse the HTML and extract jobs and pagination data
    const { jobs, totalJobs, jobsPerPage } = parseWaymoJobs(html);

    console.log(`Fetched ${jobs.length} jobs on page ${page}.`);

    // Store jobs in Firestore
    await storeWaymoJobsInFirestore(jobs);

    return { jobsOnPage: jobs.length, totalJobs, jobsPerPage };  // Return job count and pagination info
  } catch (error) {
    console.error('Error fetching Waymo jobs:', error);
    return { jobsOnPage: 0 };
  }
}

// Function to parse Waymo job data and pagination info from the HTML using Cheerio
function parseWaymoJobs(html) {
  const $ = cheerio.load(html);
  const jobs = [];

  // Extract job listings
  $('.job-search-results-card').each((index, element) => {
    const title = $(element).find('.job-search-results-card-title a').text().trim();
    const link = $(element).find('.job-search-results-card-title a').attr('href');
    const summary = $(element).find('.job-search-results-summary').text().trim();
    
    const locations = [];
    $(element).find('.job-component-location span').each((i, loc) => {
      locations.push($(loc).text().trim());
    });

    const department = $(element).find('.job-component-department span').text().trim();
    const employmentType = $(element).find('.job-component-employment-type span').text().trim();

    // Extract the job ID from the class attribute
    const jobId = $(element).find('.job-component-details').attr('class').split(' ').pop();

    // Push the job details to the jobs array
    jobs.push({
      title,
      link,
      summary,
      locations,
      department,
      employmentType,
      jobId,
      foundAt: new Date(),
    });
  });

  // Extract pagination information from the "table-counts" div
  const tableCountsText = $('.table-counts p').text();
  const match = tableCountsText.match(/Displaying.*?-(\d+).*?of\s+(\d+)/);
  const jobsPerPage = match ? parseInt(match[1], 10) : 0;
  const totalJobs = match ? parseInt(match[2], 10) : 0;

  return { jobs, totalJobs, jobsPerPage };
}

// Function to store Waymo jobs in Firestore with batching
async function storeWaymoJobsInFirestore(jobs) {
  const waymoJobsCollection = firestore.collection('waymo_jobs');
  const batch = firestore.batch(); // Firestore batch write

  jobs.forEach(job => {
    const jobDoc = waymoJobsCollection.doc(job.jobId);
    batch.set(jobDoc, {
      title: job.title,
      locations: job.locations,
      department: job.department,
      employmentType: job.employmentType,
      link: job.link,
      summary: job.summary,
      foundAt: job.foundAt,
      updatedAt: new Date(),
    });

    console.log(`Prepared job for storage: ${job.title}`);
  });

  // Commit the batch write
  await batch.commit();
  console.log('Batch write committed.');
}

// Main function to fetch and iterate through all pages
async function run() {
  let page = 1;
  let totalPages = 1;
  let jobsPerPage, totalJobs;

  do {
    const { jobsOnPage, totalJobs: fetchedTotalJobs, jobsPerPage: fetchedJobsPerPage } = await fetchWaymoJobs(page);

    // On first page, calculate total pages based on total job count and jobs per page
    if (page === 1 && fetchedJobsPerPage && fetchedTotalJobs) {
      totalJobs = fetchedTotalJobs;
      jobsPerPage = fetchedJobsPerPage;
      totalPages = Math.ceil(totalJobs / jobsPerPage);
      console.log(`Total jobs: ${totalJobs}, Jobs per page: ${jobsPerPage}, Total pages: ${totalPages}`);
    }

    page += 1;
  } while (page <= totalPages);  // Continue fetching until all pages are fetched

  console.log('Job fetching completed.');
}

// Run the job fetcher
run();
