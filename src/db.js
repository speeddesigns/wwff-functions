import { Firestore } from '@google-cloud/firestore';

export const db = new Firestore();

// Fetch all jobs for a given company
export async function fetchOpenJobs(company) {
  console.log(`Fetching jobs for ${company}...`);

  const collectionRef = db.collection(company);
  const querySnapshot = await collectionRef.get();

  const jobs = {};
  querySnapshot.forEach(doc => {
    jobs[doc.data().jobId] = {
      ...doc.data(),
      firestoreDocId: doc.id
    };
  });
  console.log(`Fetched ${Object.keys(jobs).length} jobs for ${company}`);

  return jobs;  // Returns an object mapping jobId to job data
}

// Update jobs by adding new roles, reopening existing ones, and updating changed details
export async function updateJobsWithOpenCloseLogic(company, fetchedJobs = []) {
  console.log(`Checking jobs for updates for ${company}...`);

  if (!fetchedJobs || fetchedJobs.length === 0) {
    console.log('No jobs fetched to update.');
    return;
  }

  const batch = db.batch();
  const now = Firestore.Timestamp.now();

  // Step 1: Fetch all jobs from the database
  const existingJobs = await fetchOpenJobs(company);

  // Step 2: Process each fetched job
  fetchedJobs.forEach(job => {
    const existingJob = existingJobs[job.jobId];
    let jobRef;

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
      console.log(`Adding new job ${job.jobId}`);
    } else if (!existingJob.open) {
      // Reopened job
      console.log(`Reopening job ${job.jobId}`);
      jobData.reopenedAt = now;
    } else if (checkIfJobChanged(existingJob, job)) {
      // Updated job
      console.log(`Updating changed job ${job.jobId}`);
    } else {
      // Just update lastSeen
      console.log(`Updating lastSeen for job ${job.jobId}`);
    }

    batch.set(jobRef, jobData, { merge: true });
  });

  // Step 3: Mark jobs as closed if they're not in fetchedJobs
  const fetchedJobIds = new Set(fetchedJobs.map(job => job.jobId));
  for (const jobId in existingJobs) {
    const existingJob = existingJobs[jobId];
    if (!fetchedJobIds.has(jobId) && existingJob.open) {
      console.log(`Marking job ${jobId} as closed`);
      const jobRef = db.collection(company).doc(existingJob.firestoreDocId);
      batch.update(jobRef, { 
        open: false,
        closedAt: now
      });
    }
  }

  // Step 4: Commit batch update
  await batch.commit();
  console.log(`Jobs successfully updated for ${company}`);
}

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
