import logger from './logger.js';

// Custom error classes for more specific error handling
export class JobFetchError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'JobFetchError';
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

export class NetworkError extends JobFetchError {
  constructor(message, context = {}) {
    super(message, context);
    this.name = 'NetworkError';
  }
}

export class ParseError extends JobFetchError {
  constructor(message, context = {}) {
    super(message, context);
    this.name = 'ParseError';
  }
}

// Retry mechanism for async functions
export async function retryOperation(
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
export function asyncErrorHandler(fn) {
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
export function validateJobData(job) {
  const requiredFields = ['jobId', 'title', 'url', 'company'];
  
  for (const field of requiredFields) {
    if (!job[field]) {
      throw new ParseError(`Missing required job field: ${field}`, { job });
    }
  }

  // Additional validation can be added here
  return job;
}
