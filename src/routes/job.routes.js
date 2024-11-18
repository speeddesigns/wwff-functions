import { Router } from 'express';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import jobService from '../services/job.service.js';
import { asyncErrorHandler } from '../utils/error-handling.js';
import { loadJobFetchers } from '../utils/job-loader.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  logger.info('Health check endpoint accessed');
  res.send(`${config.get('app.name')} is running in ${config.get('app.environment')} mode`);
});

// Pub/Sub-triggered job-fetching route
router.post('/fetch', asyncErrorHandler(async (req, res) => {
  logger.info('Received job fetch request', {
    environment: config.get('app.environment')
  });

  try {
    const jobFetchers = await loadJobFetchers();
    logger.info('Job fetchers loaded', { 
      companies: Object.keys(jobFetchers)
    });

    const { processedResults, summary } = await jobService.processBatchJobs(jobFetchers);

    logger.info('Job fetching tasks complete', summary);

    res.status(200).json({
      message: 'Job fetching and updating completed',
      ...summary,
      results: processedResults
    });
  } catch (error) {
    logger.error('Critical error during job fetching', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      status: 'error',
      message: 'Critical failure in job fetching process',
      timestamp: new Date().toISOString()
    });
  }
}));

export default router;
