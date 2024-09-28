import { Firestore } from '@google-cloud/firestore';

// Initialize Firestore
const db = new Firestore();

// Function to save jobs with logging
export async function saveJobs(company, jobs) {
  const batch = db.batch();
  const collectionRef = db.collection(company);

  jobs.forEach(job => {
    const jobRef = collectionRef.doc(job.jobId);
    
    // Log job info (if needed)
    console.log(`Saving job ${job.jobId} for ${company}`);
    
    // Exclude jobId from the saved document (optional)
    const { jobId, ...jobDataWithoutId } = job;
    batch.set(jobRef, jobDataWithoutId);
  });

  await batch.commit();
  console.log(`Saved ${jobs.length} jobs for ${company}.`);
}
