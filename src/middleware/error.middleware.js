import logger from '../utils/logger.js';
import config from '../config/index.js';

export function errorHandler(err, req, res, next) {
  // Log the error with appropriate level
  if (err.name === 'JobFetchError') {
    logger.error('Job fetching error', {
      error: err.message,
      context: err.context,
      stack: err.stack
    });
  } else if (err.name === 'NetworkError') {
    logger.warn('Network error', {
      error: err.message,
      context: err.context,
      stack: err.stack
    });
  } else {
    logger.error('Unhandled application error', {
      error: err.message,
      stack: err.stack,
      path: req.path
    });
  }

  // Respond with appropriate status code
  if (err.name === 'JobFetchError' || err.name === 'NetworkError') {
    res.status(500).json({
      status: 'error',
      message: err.message,
      timestamp: new Date().toISOString(),
      context: err.context
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      environment: config.isProduction() ? 'production' : config.get('app.environment')
    });
  }
}

export function notFoundHandler(req, res, next) {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method
  });

  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
}
