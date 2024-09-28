import { get } from 'https';

// Fetch HTML from a URL with headers
export function fetchHTML(url) {
  console.log(`Fetching HTML from ${url}`);

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  };

  return new Promise((resolve, reject) => {
    get(url, options, response => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
      response.on('error', err => reject(err));
    });
  });
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