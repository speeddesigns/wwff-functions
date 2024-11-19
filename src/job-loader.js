import { JobFetchError } from './utils/error-handling.js';
import logger from '../utils/logger.js';

export default class JobLoader {
  async processCompanyJobs(companyName, { fetchFunction, config: companyConfig }) {
    try {
      // Job fetching logic here
    } catch (error) {
      logger.error(`Error fetching jobs for ${companyName}`, { error: error.message });
      throw new JobFetchError(`Error fetching jobs for ${companyName}: ${error.message}`);
    }
  }
}
