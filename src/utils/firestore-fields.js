/**
 * Centralized Firestore fields for job-related data
 * These fields are designed to be consistent across different companies
 */
export const FIRESTORE_JOB_FIELDS = {
  // API-related field
  API_URL: 'api_url',
  
  // Compensation-related fields
  COMP_START_RANGE: 'compStart', // Starting compensation range
  COMP_MID_RANGE: 'compMid',     // Mid-point compensation range
  COMP_END_RANGE: 'compEnd',     // Ending compensation range
  
  // Job classification fields
  DEPARTMENT: 'department',
  JOB_FAMILY: 'jobFamily',
  
  // Job status and metadata fields
  FOUND_DATE: 'found',
  LOST_DATE: 'lost',
  OPEN_STATUS: 'open',
  
  // Job details
  LOCATION: 'location',
  TIME_TYPE: 'timeType',
  TITLE: 'title',
  URL: 'url'
};

/**
 * Validates a job object against the defined Firestore fields
 * @param {Object} job - The job object to validate
 * @returns {boolean} - Whether the job object contains all required fields
 */
export function validateJobFields(job) {
  const requiredFields = Object.values(FIRESTORE_JOB_FIELDS);
  return requiredFields.every(field => job.hasOwnProperty(field));
}
