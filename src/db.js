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

// Update jobs by adding new roles, closing missing ones, and handling updates for job details
export async function updateJobsWithOpenCloseLogic(fetchedJobs = []) {
  console.log(`Checking jobs for updates...`);

  if (!fetchedJobs || fetchedJobs.length === 0) {
    console.log('No jobs fetched to update.');
    return;
  }

  const batch = db.batch();
  const company = 'Waymo';  // Replace with dynamic company if needed
  const collectionRef = db.collection(company);

  // Step 1: Fetch all currently open jobs from the database
  const openJobs = await fetchOpenJobs(company);

  // Step 2: Mark jobs that are no longer open
  const fetchedJobIds = new Set(fetchedJobs.map(job => job.jobId));
  for (const jobId in openJobs) {
    if (!fetchedJobIds.has(jobId)) {
      console.log(`Marking job ${jobId} as closed.`);
      const jobRef = collectionRef.doc(jobId);
      batch.update(jobRef, { open: false });
    }
  }

  // Step 3: Add new jobs to the database or update existing ones if details have changed
  fetchedJobs.forEach(job => {
    const existingJob = openJobs[job.jobId];
    const jobRef = collectionRef.doc(job.jobId);

    if (existingJob) {
      // If the job exists, check if it has changed
      if (checkIfJobChanged(existingJob, job)) {
        console.log(`Updating job ${job.jobId}...`);
        batch.set(jobRef, { ...job, open: true }, { merge: true });
      } else {
        console.log(`No changes detected for job ${job.jobId}.`);
      }
    } else {
      // New job, needs to be added
      batch.set(jobRef, { ...job, open: true }, { merge: true });
      console.log(`New job ${job.jobId} added.`);
    }
  });

  // Step 4: Commit batch update
  await batch.commit();
  console.log(`Jobs successfully updated for ${company}.`);
}

// Check if job details have changed
function checkIfJobChanged(existingJob, newJob) {
  console.log(`Checking if job ${newJob.jobId} has changed...`);

  return existingJob.title !== newJob.title ||
         existingJob.location !== newJob.location ||
         existingJob.compensation !== newJob.compensation;
}


// Fetch a specific job from the database
export async function fetchJobFromDB(company, jobId) {
  const docRef = db.collection(company).doc(jobId);
  const doc = await docRef.get();

  if (!doc.exists) {
    console.log(`No job found for jobId: ${jobId}`);
    return null;
  }

  return doc.data();  // Returns the job data
}

// Update job details in the database if they differ from the existing data
export async function updateJobDetails(company, jobId, newDetails) {
  const jobRef = db.collection(company).doc(jobId);
  await jobRef.update(newDetails);
  console.log(`Updated job details for jobId: ${jobId}`);
}
