import logger from '../utils/logger.js';
import config from '../config/index.js';
import { 
  JobFetchError, 
  retryOperation,
  validateJobData 
} from '../utils/error-handling.js';
import { updateJobsWithOpenCloseLogic } from '../db.js';

class JobService {
  constructor() {
    this.maxConcurrentFetches = config.get('jobFetching.maxConcurrentFetches');
    this.retryAttempts = config.get('jobFetching.retryAttempts');
    this.baseRetryDelay = config.get('jobFetching.baseRetryDelay');
  }

  async processCompanyJobs(companyName, { fetchFunction, config: companyConfig }) {
    try {
      logger.info(`Fetching jobs for ${companyName}`, { 
        maxJobsPerFetch: companyConfig.maxJobsPerFetch 
      });

      const result = await this._fetchJobsWithRetry(fetchFunction, companyConfig);
      await this._updateJobsWithRetry(companyName, result.jobs);

      logger.info(`Successfully processed jobs for ${companyName}`, {
        jobCount: result.jobs.length
      });

      return {
        company: companyName,
        jobCount: result.jobs.length,
        status: 'success'
      };
    } catch (error) {
      logger.error(`Error processing jobs for ${companyName}`, {
        error: error.message,
        type: error.name,
        stack: error.stack
      });

      return {
        company: companyName,
        jobCount: 0,
        status: 'error',
        error: {
          message: error.message,
          type: error.name,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async processBatchJobs(jobFetchers) {
    const companies = Object.entries(jobFetchers)
      .slice(0, this.maxConcurrentFetches);

    const jobResults = await Promise.allSettled(
      companies.map(([companyName, fetcherInfo]) => 
        this.processCompanyJobs(companyName, fetcherInfo)
      )
    );

    return this._processResults(jobResults);
  }

  async _fetchJobsWithRetry(fetchFunction, companyConfig) {
    return retryOperation(
      async () => {
        const fetchedResult = await fetchFunction();
        
        fetchedResult.jobs = fetchedResult.jobs
          .map(validateJobData)
          .slice(0, companyConfig.maxJobsPerFetch);
        
        return fetchedResult;
      },
      { 
        maxRetries: this.retryAttempts, 
        baseDelay: this.baseRetryDelay
      }
    );
  }

  async _updateJobsWithRetry(companyName, jobs) {
    return retryOperation(
      () => updateJobsWithOpenCloseLogic(companyName, jobs),
      { 
        maxRetries: this.retryAttempts, 
        baseDelay: this.baseRetryDelay
      }
    );
  }

  _processResults(jobResults) {
    const processedResults = jobResults.map(result => 
      result.status === 'fulfilled' ? result.value : {
        status: 'error',
        error: result.reason,
        timestamp: new Date().toISOString()
      }
    );

    const successfulCompanies = processedResults.filter(r => r.status === 'success');
    const failedCompanies = processedResults.filter(r => r.status === 'error');

    return {
      processedResults,
      summary: {
        successful: successfulCompanies.length,
        failed: failedCompanies.length
      }
    };
  }
}

export default new JobService();
