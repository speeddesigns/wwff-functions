import puppeteer from 'puppeteer';

// Fetch HTML using Puppeteer
export async function fetchHTML(url, referrerUrl) {
  console.log(`Fetching HTML from ${url} using Puppeteer...`);

  let browser;
  try {
    // Launch Puppeteer in headless mode
    browser = await puppeteer.launch({
      headless: 'new',  // You can set this to 'false' to see the browser in action
      executablePath: '/usr/bin/google-chrome-stable',  // Path to the Chrome executable
      args: ['--no-sandbox', '--disable-setuid-sandbox'],  // Required if running in environments like Cloud Run
    });

    const page = await browser.newPage();

    // Set user-agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

     // Set the referrer in the HTTP headers
     await page.setExtraHTTPHeaders({
      'Referer': referrerUrl || 'https://www.indeed.com',  // Use provided referrer or a default one
    });

    // Navigate to the URL
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for the necessary elements to load (adjust if needed)
    await page.waitForSelector('body');  // Adjust the selector to match your requirements

    // Get the page content
    const html = await page.content();

    console.log('HTML fetching completed.');
    return html;
  } catch (error) {
    console.error('Error fetching HTML:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Extract salary data from the job description using regex
export function extractSalaryFromDescription(description) {
  const salaryRegex = /₹?[\d,.]+(?:\s?[kK]?\s?-\s?\₹?[\d,.]+\s?[kK]?)?/g;
  const matches = description.match(salaryRegex);

  if (!matches) return null;

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

// Randomized delay function with human-readable seconds input
export function randomizedDelay(minSeconds, maxSeconds) {
  const minMilliseconds = minSeconds * 1000;
  const maxMilliseconds = maxSeconds * 1000;
  const delay = Math.floor(Math.random() * (maxMilliseconds - minMilliseconds + 1)) + minMilliseconds;
  
  return new Promise(resolve => setTimeout(resolve, delay));
}