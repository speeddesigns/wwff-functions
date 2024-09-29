import axios from 'axios';
import * as cheerio from 'cheerio';

// Store headers for subsequent requests
let storedHeaders = {};

// Fetch HTML using axios and cheerio
export async function fetchHTML(url, referrerUrl, useStoredHeaders = false) {
  console.log(`Fetching HTML from ${url} using axios...`);

  try {
    let headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': referrerUrl || 'https://www.indeed.com',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    };

    // Use stored headers if requested
    if (useStoredHeaders) {
      headers = { ...headers, ...storedHeaders };
    }

    const response = await axios.get(url, { headers });
    const html = response.data;

    // Store received headers for future requests
    storedHeaders = { ...storedHeaders, ...response.headers };

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

  return new Promise(resolve => setTimeout(resolve, delay));
}