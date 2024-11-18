import fs from 'fs/promises';
import path from 'path';
import logger from './utils/logger.js';
import config from './config/index.js';
import { JobFetchError } from './utils/error-handling.js';

export async function loadJobFetchers() {
  try {
    const companiesDir = path.resolve('./src/companies');
    const files = await fs.readdir(companiesDir);
    const jobFetchers = {};

    const companyConfigs = config.get('jobFetching.companies');

    for (const file of files) {
      if (file.endsWith('.js')) {
        const companyName = file.replace('.js', '').replace(/\b\w/g, l => l.toUpperCase());
        const companyConfig = companyConfigs[companyName.toLowerCase()];

        // Skip if company is not enabled
        if (companyConfig && !companyConfig.enabled) {
          logger.info(`Skipping disabled company: ${companyName}`);
          continue;
        }

        const modulePath = `./companies/${file}`;
        const module = await import(modulePath);
        
        const fetchFunction = findFetchFunction(module);

        if (fetchFunction) {
          jobFetchers[companyName] = {
            fetchFunction,
            config: companyConfig
          };
          logger.debug(`Imported job fetcher for ${companyName}`);
        }
      }
    }

    return jobFetchers;
  } catch (error) {
    logger.error('Error loading job fetchers', {
      error: error.message,
      stack: error.stack
    });
    throw new JobFetchError('Failed to load job fetchers', { originalError: error });
  }
}

function findFetchFunction(module) {
  return Object.values(module).find(
    func => typeof func === 'function' && 
    func.name.startsWith('fetch') && 
    func.name.endsWith('Jobs')
  );
}
