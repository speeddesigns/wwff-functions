import { Firestore } from '@google-cloud/firestore';

// Initialize Firestore
const db = new Firestore();

// Function to save jobs
export async function saveJobs(company, jobs) {
  const batch = db.batch();

  jobs.forEach(job => {
    const jobRef = db.collection(company).doc(job.jobId);
    batch.set(jobRef, job);
  });

  await batch.commit();
  console.log(`Saved ${jobs.length} jobs for ${company}.`);
}
