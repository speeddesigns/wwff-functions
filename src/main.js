import express from 'express';
import config from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import jobRouter from './routes/job.routes.js';

const app = express();

// Middleware
app.use(express.json());
app.use('/api/jobs', jobRouter);

// Error handling
app.use(errorHandler);
app.use(notFoundHandler);

// Start the Express server and listen on the configured port
const port = process.env.PORT || config.get('app.port');
app.listen(port, () => {
  logger.info(`Server is listening on port ${port}`, {
    environment: config.get('app.environment'),
    appName: config.get('app.name')
  });
});

export default app;
