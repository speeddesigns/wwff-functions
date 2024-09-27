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
    await saveJobs('waymo', jobs);
    console.log(`Saved ${jobs.length} jobs to Firestore for waymo.`);

  } catch (error) {
    console.error('Error fetching jobs from Waymo:', error);
  }
}

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

function parseWaymoJobs(html) {
  console.log('Parsing Waymo job listings...');
  const $ = load(html);
  const jobs = [];
  
  $('.job-search-results-card').each((index, element) => {
    const jobId = $(element).find('.job-component-details').attr('class').split(' ').pop();
    const title = $(element).find('.job-search-results-card-title a').text().trim();
    const link = $(element).find('.job-search-results-card-title a').attr('href');
    const summary = $(element).find('.job-search-results-summary').text().trim();
    
    console.log(`Parsed job ${index + 1}: ${title} (ID: ${jobId})`);

    jobs.push({
      jobId,
      title,
      link,
      summary,
      foundAt: new Date()
    });
  });

  console.log(`Finished parsing jobs. Total jobs found: ${jobs.length}`);
  return jobs;
}

export default fetchWaymoJobs;