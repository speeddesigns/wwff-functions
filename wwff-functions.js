import express from 'express';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Firestore } from '@google-cloud/firestore';
import fs from 'fs';
import path from 'path';

// Configuration Management
class ConfigurationManager {
  constructor() {
    this.config = {};
    this.loadConfiguration();
  }

  loadConfiguration() {
    // Priority: Environment Variables > Config File > Default Values
    this.config = {
      // Application Settings
      app: {
        name: process.env.APP_NAME || 'Job Fetcher',
        environment: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT, 10) || 8080,
        logLevel: process.env.LOG_LEVEL || 'info'
      },

      // Database Configuration
      database: {
        type: process.env.DB_TYPE || 'firestore',
        projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
        credentials: this.loadCredentials()
      },

      // Job Fetching Configuration
      jobFetching: {
        maxConcurrentFetches: parseInt(process.env.MAX_CONCURRENT_FETCHES, 10) || 5,
        retryAttempts: parseInt(process.env.RETRY_ATTEMPTS, 10) || 3,
        baseRetryDelay: parseInt(process.env.BASE_RETRY_DELAY, 10) || 1000,
        companies: this.loadCompanyConfigs()
      },

      // Logging Configuration
      logging: {
        logDirectory: process.env.LOG_DIRECTORY || path.resolve(process.cwd(), 'logs'),
        maxLogFiles: parseInt(process.env.MAX_LOG_FILES, 10) || 5,
        maxLogSize: parseInt(process.env.MAX_LOG_SIZE, 10) || 5 * 1024 * 1024 // 5MB
      }
    };

    this.validateConfiguration();
    this.logConfigurationSummary();
  }

  loadCredentials() {
    // Load Google Cloud credentials
    try {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      return credPath && fs.existsSync(credPath) 
        ? JSON.parse(fs.readFileSync(credPath, 'utf8'))
        : null;
    } catch (error) {
      logger.warn('Failed to load credentials', { error: error.message });
      return null;
    }
  }

  loadCompanyConfigs() {
    // Dynamic company configuration loading
    const defaultCompanyConfig = {
      fetchInterval: 24 * 60 * 60 * 1000, // 24 hours
      maxJobsPerFetch: 100,
      enabled: true
    };

    try {
      const companiesDir = path.resolve(process.cwd(), 'src', 'companies');
      const companyFiles = fs.readdirSync(companiesDir)
        .filter(file => file.endsWith('.js'));

      return companyFiles.reduce((configs, file) => {
        const companyName = file.replace('.js', '');
        configs[companyName] = {
          ...defaultCompanyConfig,
          ...this.getCompanyEnvConfig(companyName)
        };
        return configs;
      }, {});
    } catch (error) {
      logger.warn('Error loading company configurations', { error: error.message });
      return {};
    }
  }

  getCompanyEnvConfig(companyName) {
    // Load company-specific environment configurations
    return {
      fetchInterval: parseInt(process.env[`${companyName.toUpperCase()}_FETCH_INTERVAL`], 10) || undefined,
      maxJobsPerFetch: parseInt(process.env[`${companyName.toUpperCase()}_MAX_JOBS`], 10) || undefined,
      enabled: process.env[`${companyName.toUpperCase()}_ENABLED`] !== 'false'
    };
  }

  validateConfiguration() {
    const validations = [
      {
        test: () => this.config.app.port > 0 && this.config.app.port < 65536,
        message: 'Invalid port number'
      },
      {
        test: () => ['development', 'production', 'test'].includes(this.config.app.environment),
        message: 'Invalid environment'
      },
      {
        test: () => this.config.jobFetching.maxConcurrentFetches > 0,
        message: 'Invalid max concurrent fetches'
      }
    ];

    validations.forEach(({ test, message }) => {
      if (!test()) {
        throw new Error(`Configuration Error: ${message}`);
      }
    });
  }

  logConfigurationSummary() {
    logger.info('Configuration Loaded', {
      environment: this.config.app.environment,
      appName: this.config.app.name,
      companies: Object.keys(this.config.jobFetching.companies),
      logLevel: this.config.app.logLevel
    });
  }

  get(key) {
    const keys = key.split('.');
    return keys.reduce((config, k) => config && config[k], this.config);
  }

  isProduction() {
    return this.config.app.environment === 'production';
  }
}

const config = new ConfigurationManager();

const app = express();

app.use(express.json());

app.listen(config.get('app.port'), () => {
    console.log(`Server is running on port ${config.get('app.port')}`);
});

// Custom error classes for more specific error handling
class JobFetchError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'JobFetchError';
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

class NetworkError extends JobFetchError {
  constructor(message, context = {}) {
    super(message, context);
    this.name = 'NetworkError';
  }
}

class ParseError extends JobFetchError {
  constructor(message, context = {}) {
    super(message, context);
    this.name = 'ParseError';
  }
}

// Retry mechanism for async functions
async function retryOperation(
  operation, 
  { 
    maxRetries = 3, 
    baseDelay = 1000, 
    exponentialBackoff = true 
  } = {}
) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      retries++;
      
      if (retries >= maxRetries) {
        logger.error(`Operation failed after ${maxRetries} attempts`, {
          error: error.message,
          stack: error.stack
        });
        throw error;
      }

      const delay = exponentialBackoff 
        ? baseDelay * Math.pow(2, retries)
        : baseDelay;

      logger.warn(`Retry attempt ${retries} after error`, {
        error: error.message,
        delay
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Global error handler for async functions
function asyncErrorHandler(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error('Unhandled async error', {
        error: error.message,
        stack: error.stack,
        args
      });
      throw error;
    }
  };
}

// Validate job data before processing
function validateJobData(job) {
  const requiredFields = ['jobId', 'title', 'url', 'company'];
  
  for (const field of requiredFields) {
    if (!job[field]) {
      throw new ParseError(`Missing required job field: ${field}`, { job });
    }
  }

  // Additional validation can be added here
  return job;
}

// Fetch all jobs for a given company with enhanced error handling
const db = new Firestore();
export const fetchOpenJobs = asyncErrorHandler(async (company) => {
  logger.info(`Fetching jobs for ${company}`);

  const collectionRef = db.collection(company);
  const querySnapshot = await retryOperation(
    () => collectionRef.get(),
    { 
      maxRetries: 3, 
      baseDelay: 1000 
    }
  );

  const jobs = {};
  const invalidJobs = [];

  querySnapshot.forEach(doc => {
    const jobData = doc.data();
    
    try {
      // Validate job data during fetch
      const validatedJob = validateJobData({
        ...jobData,
        firestoreDocId: doc.id
      });

      jobs[validatedJob.jobId] = validatedJob;
    } catch (validationError) {
      logger.warn('Skipping invalid job during fetch', {
        jobId: jobData.jobId,
        error: validationError.message
      });
      invalidJobs.push({
        jobData,
        error: validationError.message
      });
    }
  });

  if (invalidJobs.length > 0) {
    logger.error('Some jobs were invalid during fetch', {
      company,
      invalidJobCount: invalidJobs.length
    });
  }

  logger.info(`Fetched ${Object.keys(jobs).length} valid jobs for ${company}`, {
    validJobCount: Object.keys(jobs).length,
    invalidJobCount: invalidJobs.length
  });

  return jobs;
});

// Update jobs by adding new roles, reopening existing ones, and updating changed details
export const updateJobsWithOpenCloseLogic = asyncErrorHandler(async (company, fetchedJobs = []) => {
  logger.info(`Checking jobs for updates for ${company}`);

  if (!fetchedJobs || fetchedJobs.length === 0) {
    logger.warn('No jobs fetched to update');
    return;
  }

  const batch = db.batch();
  const now = Firestore.Timestamp.now();

  // Step 1: Fetch all jobs from the database
  const existingJobs = await fetchOpenJobs(company);

  // Validate all fetched jobs before processing
  const validatedJobs = fetchedJobs.map(validateJobData);

  // Step 2: Process each fetched job
  const updates = [];
  const errors = [];

  validatedJobs.forEach(job => {
    const existingJob = existingJobs[job.jobId];
    let jobRef;

    try {
      if (existingJob) {
        // Use existing document reference
        jobRef = db.collection(company).doc(existingJob.firestoreDocId);
      } else {
        // Create new document reference
        jobRef = db.collection(company).doc();
      }

      const jobData = {
        ...job,
        company,
        open: true,
        lastSeen: now
      };

      if (!existingJob) {
        // New job
        jobData.found = now;
        logger.info(`Adding new job ${job.jobId}`);
      } else if (!existingJob.open) {
        // Reopened job
        logger.info(`Reopening job ${job.jobId}`);
        jobData.reopenedAt = now;
      } else if (checkIfJobChanged(existingJob, job)) {
        // Updated job
        logger.info(`Updating changed job ${job.jobId}`);
      } else {
        // Just update lastSeen
        logger.debug(`Updating lastSeen for job ${job.jobId}`);
      }

      batch.set(jobRef, jobData, { merge: true });
      updates.push(job);
    } catch (updateError) {
      logger.error(`Error processing job ${job.jobId}`, {
        error: updateError.message,
        job
      });
      errors.push({
        jobId: job.jobId,
        error: updateError.message
      });
    }
  });

  // Step 3: Mark jobs as closed if they're not in fetchedJobs
  const fetchedJobIds = new Set(validatedJobs.map(job => job.jobId));
  for (const jobId in existingJobs) {
    const existingJob = existingJobs[jobId];
    if (!fetchedJobIds.has(jobId) && existingJob.open) {
      logger.info(`Marking job ${jobId} as closed`);
      const jobRef = db.collection(company).doc(existingJob.firestoreDocId);
      batch.update(jobRef, { 
        open: false,
        closedAt: now
      });
    }
  }

  // Step 4: Commit batch update with retry mechanism
  await retryOperation(
    () => batch.commit(),
    { 
      maxRetries: 3, 
      baseDelay: 1500 
    }
  );

  logger.info(`Jobs successfully updated for ${company}`, {
    updatedJobCount: updates.length,
    errorCount: errors.length
  });

  if (errors.length > 0) {
    throw new JobFetchError('Some jobs failed to update', {
      company,
      errors
    });
  }
});

// Check if job details have changed
function checkIfJobChanged(existingJob, newJob) {
  const fieldsToCompare = [
    'title',
    'url',
    'description',
    'location',
    'employmentType',
    'datePosted',
    'validThrough',
    'hiringOrganization',
    'jobFamily',
    'department',
    'compStart',
    'compMid',
    'compEnd'
  ];

  return fieldsToCompare.some(field => {
    if (typeof existingJob[field] === 'object' && typeof newJob[field] === 'object') {
      return JSON.stringify(existingJob[field]) !== JSON.stringify(newJob[field]);
    }
    return existingJob[field] !== newJob[field];
  });
}

// Logger
const logger = {
  info(message, ...args) {
    console.log(message, ...args);
  },
  error(message, ...args) {
    console.error(message, ...args);
  }
};

// Handle Pub/Sub event
app.post('/pubsub', asyncErrorHandler(async (req, res) => {
    // Dynamically import and call all company-specific job fetching functions
    const companiesDir = join(__dirname, 'src', 'companies');
    const companyFiles = readdirSync(companiesDir);

    for (const file of companyFiles) {
        if (file.endsWith('.js')) {
            const module = await import(join(companiesDir, file));
            const jobFetchingFunction = Object.values(module).find(
                (value) => typeof value === 'function' && value.name.startsWith('fetch')
            );
            if (jobFetchingFunction) {
                await jobFetchingFunction();
            }
        }
    }

    res.status(200).send('Job capturing complete');
}));

export default app;
