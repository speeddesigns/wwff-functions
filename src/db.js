import { Firestore } from '@google-cloud/firestore';

export const db = new Firestore();

// Fetch all open jobs for a company
export async function fetchOpenJobs(company) {
  const collectionRef = db.collection(company);
  const querySnapshot = await collectionRef.where('open', '==', true).get();

  const openJobs = {};
  querySnapshot.forEach(doc => {
    openJobs[doc.id] = doc.data();
  });

  return openJobs;  // Returns a map of jobId to job data
}

// Update or add jobs based on comparison
export async function updateJobs(company, fetchedJobs) {
  const batch = db.batch();
  const collectionRef = db.collection(company);

  // Fetch currently open jobs from Firestore
  const openJobsInFirestore = await fetchOpenJobs(company);

  // Prepare arrays for new, updated, and closed jobs
  const jobsToAddOrUpdate = [];
  const jobsToClose = [];

  // Iterate over jobs fetched from the website
  fetchedJobs.forEach(job => {
    const existingJob = openJobsInFirestore[job.jobId];
    
    // If the job exists, check if it needs to be updated
    if (existingJob) {
      const hasChanged = checkIfJobChanged(existingJob, job);
      if (hasChanged) {
        jobsToAddOrUpdate.push(job);
      }
      // Remove the job from the openJobsInFirestore list
      delete openJobsInFirestore[job.jobId];
    } else {
      // Job is new, add it to the list
      jobsToAddOrUpdate.push(job);
    }
  });

  // Any job remaining in openJobsInFirestore wasn't found on the website, so close it
  Object.keys(openJobsInFirestore).forEach(jobId => {
    const jobRef = collectionRef.doc(jobId);
    batch.update(jobRef, { open: false, closedAt: new Date() });
    jobsToClose.push(jobId);
  });

  // Process adding or updating jobs
  jobsToAddOrUpdate.forEach(job => {
    const jobRef = collectionRef.doc(job.jobId);
    const { jobId, ...jobDataWithoutId } = job;  // Remove jobId before saving
    batch.set(jobRef, jobDataWithoutId, { merge: true });
  });

  // Commit the batch
  await batch.commit();
  
  console.log(`Processed ${jobsToAddOrUpdate.length} jobs (added/updated) and closed ${jobsToClose.length} jobs.`);
}

// Utility function to check if job data has changed
function checkIfJobChanged(existingJob, newJob) {
  // Compare key fields (title, location, etc.) and return true if they differ
  return existingJob.title !== newJob.title || 
         existingJob.location !== newJob.location ||
         existingJob.compensation !== newJob.compensation;
}
