import express from 'express';
import logger from './utils/logger.js';
import config from './config/index.js';
import jobRouter from './routes/job.routes.js';
import logger from './utils/logger';

logger.info('Application starting...');

const app = express();

// Middleware
app.use(express.json());
app.use('/api/jobs', jobRouter);

// Start the Express server and listen on the configured port
const port = config.get('app.port');
app.listen(port, () => {
  logger.info(`Server is listening on port ${port}`, {
    environment: config.get('app.environment'),
    appName: config.get('app.name')
  });
});

export default app;