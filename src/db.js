import { Firestore } from '@google-cloud/firestore';

export const db = new Firestore();

// Fetch all open jobs for a given company
export async function fetchOpenJobs(company) {
  console.log(`Fetching open jobs for ${company}...`);

  const collectionRef = db.collection(company);
  const querySnapshot = await collectionRef.where('open', '==', true).get();

  const openJobs = {};
  querySnapshot.forEach(doc => {
    openJobs[doc.id] = doc.data();
  });
  console.log(`Fetched ${Object.keys(openJobs).length} open jobs for ${company}`);

  return openJobs;  // Returns an object mapping jobId to job data
}

// Update jobs by comparing with fetched jobs
export async function updateJobs(company, fetchedJobs = []) {
  console.log(`Checking ${company} jobs for updates...`);

  if (!fetchedJobs || fetchedJobs.length === 0) {
    console.log(`No jobs to update for ${company}`);
    return;
  }

  const batch = db.batch();
  const collectionRef = db.collection(company);

  // Fetch open jobs from Firestore
  console.log(`Fetching open jobs for ${company}...`);
  const openJobsInFirestore = await fetchOpenJobs(company);

  const jobsToAddOrUpdate = [];
  const jobsToClose = [];

  // Iterate over fetched jobs to compare and decide action
  fetchedJobs.forEach(job => {
    console.log(`Checking job ${job.jobId}...`);

    const existingJob = openJobsInFirestore[job.jobId];

    if (existingJob) {
      // If job exists, check for changes
      const hasChanged = checkIfJobChanged(existingJob, job);
      if (hasChanged) jobsToAddOrUpdate.push(job);

      delete openJobsInFirestore[job.jobId];  // Mark job as processed
    } else {
      // New job, needs to be added
      jobsToAddOrUpdate.push(job);
      console.log(`New job ${job.jobId} added.`);
    }
  });

  // Close jobs that are no longer listed on the website
  Object.keys(openJobsInFirestore).forEach(jobId => {
    console.log(`Closing job ${jobId} that is no longer listed.`);
    const jobRef = collectionRef.doc(jobId);
    batch.update(jobRef, { open: false, closedAt: new Date() });
    jobsToClose.push(jobId);
  });

  // Add or update jobs in Firestore
  await saveJobsToFirestore(company, jobsToAddOrUpdate, batch);

  await batch.commit();
  console.log(`Processed ${jobsToAddOrUpdate.length} jobs (added/updated) and closed ${jobsToClose.length} jobs.`);
}

// Save jobs to Firestore (with batch support)
export async function saveJobsToFirestore(company, jobs, batch = null) {
  console.log(`Saving jobs for ${company}...`);

  const collectionRef = db.collection(company);

  for (const job of jobs) {
    console.log(`Saving job ${job.jobId}...`);

    try {
      const jobDocRef = collectionRef.doc(job.jobId);  // Use Firestore collection
      const jobData = {
        title: job.title,
        description: job.description,
        datePosted: job.datePosted,
        employmentType: job.employmentType,
        validThrough: job.validThrough,
        hiringOrganizationName: job.hiringOrganization?.name,
        jobLocation: job.jobLocation,
        foundAt: new Date(),
      };

      if (batch) {
        batch.set(jobDocRef, jobData, { merge: true });  // Add to the batch if provided
      } else {
        await jobDocRef.set(jobData, { merge: true });  // Directly save if no batch
      }
      console.log(`Job ${job.jobId} saved successfully.`);
    } catch (error) {
      console.error(`Error saving job ${job.jobId}:`, error);
    }
  }

  console.log(`Finished saving jobs for ${company}`);
}

// Check if job details have changed
function checkIfJobChanged(existingJob, newJob) {
  console.log(`Checking if job ${newJob.jobId} has changed...`);

  return existingJob.title !== newJob.title ||
         existingJob.location !== newJob.location ||
         existingJob.compensation !== newJob.compensation;
}