import { Firestore } from '@google-cloud/firestore';

export const db = new Firestore();

// Fetch all companies from the Companies collection
export async function fetchCompanies() {
  console.log('Fetching list of companies...');
  const companiesSnapshot = await db.collection('Companies').get();
  const companies = [];
  companiesSnapshot.forEach(doc => {
    companies.push(doc.id);
  });
  console.log(`Found ${companies.length} companies: ${companies.join(', ')}`);
  return companies;
}

// Fetch all open jobs for a given company from its dedicated collection
export async function fetchOpenJobs(company) {
  console.log(`Fetching open jobs for ${company}...`);

  const collectionRef = db.collection(company);
  const querySnapshot = await collectionRef.where('open', '==', true).get();

  const openJobs = {};
  querySnapshot.forEach(doc => {
    openJobs[doc.data().jobId] = doc.data();
  });
  console.log(`Fetched ${Object.keys(openJobs).length} open jobs for ${company}`);

  return openJobs;  // Returns an object mapping jobId to job data
}

// Update jobs by adding new roles, closing missing ones, and handling updates for job details
export async function updateJobsWithOpenCloseLogic(company, fetchedJobs = []) {
  console.log(`Checking jobs for updates for ${company}...`);

  if (!fetchedJobs || fetchedJobs.length === 0) {
    console.log('No jobs fetched to update.');
    return;
  }

  const batch = db.batch();

  // Step 1: Fetch all currently open jobs from the database
  const openJobs = await fetchOpenJobs(company);

  // Step 2: Mark jobs that are no longer open
  const fetchedJobIds = new Set(fetchedJobs.map(job => job.jobId));
  for (const jobId in openJobs) {
    if (!fetchedJobIds.has(jobId)) {
      console.log(`Marking job ${jobId} as closed.`);
      const jobRef = db.collection(company).doc(openJobs[jobId].firestoreDocId);
      batch.update(jobRef, { open: false });
    }
  }

  // Step 3: Add new jobs to the database or update existing ones if details have changed
  fetchedJobs.forEach(job => {
    const existingJob = openJobs[job.jobId];
    const jobRef = db.collection(company).doc();

    const jobData = {
      ...job,
      company,
      open: true,
    };

    if (existingJob) {
      // If the job exists, check if it has changed
      if (checkIfJobChanged(existingJob, job)) {
        console.log(`Updating job ${job.jobId}...`);
        batch.set(db.collection(company).doc(existingJob.firestoreDocId), jobData, { merge: true });
      } else {
        console.log(`No changes detected for job ${job.jobId}.`);
      }
    } else {
      // New job, add found timestamp
      jobData.found = Firestore.Timestamp.now();
      batch.set(jobRef, jobData);
      console.log(`New job ${job.jobId} added with found timestamp.`);
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
export async function fetchJobFromDB(jobId, company) {
  const collectionRef = db.collection(company);
  const querySnapshot = await collectionRef.where('jobId', '==', jobId).get();

  if (querySnapshot.empty) {
    console.log(`No job found for jobId: ${jobId}`);
    return null;
  }

  return querySnapshot.docs[0].data();  // Returns the job data
}

// Update job details in the database if they differ from the existing data
export async function updateJobDetails(jobId, company, newDetails) {
  const collectionRef = db.collection(company);
  const querySnapshot = await collectionRef.where('jobId', '==', jobId).get();

  if (!querySnapshot.empty) {
    const jobRef = querySnapshot.docs[0].ref;
    await jobRef.update(newDetails);
    console.log(`Updated job details for jobId: ${jobId}`);
  } else {
    console.log(`Job not found for jobId: ${jobId}`);
  }
}
