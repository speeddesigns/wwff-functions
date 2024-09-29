import axios from 'axios';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

// Initialize the cookie jar
const cookieJar = new CookieJar();
const client = wrapper(axios.create({
  jar: cookieJar,  // Use cookie jar
  withCredentials: true  // Ensure cookies are sent
}));

// Function to fetch HTML using axios and cheerio with cookie jar support
export async function fetchHTML(url, referrerUrl, useStoredHeaders = false) {
  console.log(`Fetching HTML from ${url} using axios with cookie jar...`);

  try {
    // Default headers
    let headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };

    // Set referer if provided
    if (referrerUrl) {
      headers['Referer'] = referrerUrl;
      console.log(`Referrer set to ${referrerUrl}`);
    } else {
      console.log('No referrer URL provided.');
    }

    // Make the request with axios (client handles cookies via cookie jar)
    const response = await client.get(url, { headers });
    const html = response.data;

    console.log('HTML fetching completed.');
    return html;
  } catch (error) {
    console.error('Error fetching HTML:', error);
    throw error;
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
  
  console.log(`Randomized delay of ${delay / 1000} seconds (${delay/1000/60} minutes).`);
  return new Promise(resolve => setTimeout(resolve, delay));
}