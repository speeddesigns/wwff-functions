import logger from '../utils/logger.js';
import config from '../config/index.js';
import { 
  JobFetchError, 
  NetworkError,
  retryOperation,
  validateJobData 
} from '../utils/error-handling.js';
import { updateJobsWithOpenCloseLogic } from '../db.js';
import { createMetrics, incrementMetric, observeMetric } from '../utils/metrics.js';

class JobService {
  constructor() {
    this.maxConcurrentFetches = config.get('jobFetching.maxConcurrentFetches');
    this.retryAttempts = config.get('jobFetching.retryAttempts');
    this.baseRetryDelay = config.get('jobFetching.baseRetryDelay');

    // Initialize metrics
    this.metrics = createMetrics({
      jobsFetched: { type: 'counter', help: 'Total jobs fetched' },
      jobsUpdated: { type: 'counter', help: 'Total jobs updated' },
      fetchDuration: { type: 'histogram', help: 'Job fetch duration' },
      updateDuration: { type: 'histogram', help: 'Job update duration' },
      fetchErrors: { type: 'counter', help: 'Job fetch errors' },
      updateErrors: { type: 'counter', help: 'Job update errors' }
    });
  }

  async processCompanyJobs(companyName, { fetchFunction, config: companyConfig }) {
    try {
      logger.info(`Fetching jobs for ${companyName}`, { 
        maxJobsPerFetch: companyConfig.maxJobsPerFetch 
      });

      const fetchStartTime = Date.now();
      const result = await this._fetchJobsWithRetry(fetchFunction, companyConfig);
      const fetchDuration = Date.now() - fetchStartTime;
      observeMetric(this.metrics.fetchDuration, fetchDuration);
      incrementMetric(this.metrics.jobsFetched, result.jobs.length);

      const updateStartTime = Date.now();
      await this._updateJobsWithRetry(companyName, result.jobs);
      const updateDuration = Date.now() - updateStartTime;
      observeMetric(this.metrics.updateDuration, updateDuration);
      incrementMetric(this.metrics.jobsUpdated, result.jobs.length);

      logger.info(`Successfully processed jobs for ${companyName}`, {
        jobCount: result.jobs.length
      });

      return {
        company: companyName,
        jobCount: result.jobs.length,
        status: 'success'
      };
    } catch (error) {
      if (error.name === 'JobFetchError') {
        logger.error(`Error fetching jobs for ${companyName}`, {
          error: error.message,
          context: error.context,
          stack: error.stack
        });
        incrementMetric(this.metrics.fetchErrors, 1);
      } else if (error.name === 'NetworkError') {
        logger.warn(`Network error fetching jobs for ${companyName}`, {
          error: error.message,
          context: error.context,
          stack: error.stack
        });
        incrementMetric(this.metrics.fetchErrors, 1);
      } else {
        logger.error(`Unexpected error processing jobs for ${companyName}`, {
          error: error.message,
          type: error.name,
          stack: error.stack
        });
        incrementMetric(this.metrics.fetchErrors, 1);
        incrementMetric(this.metrics.updateErrors, 1);
      }

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
