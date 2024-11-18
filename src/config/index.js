import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

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

export default new ConfigurationManager();
