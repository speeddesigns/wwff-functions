const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore();

async function saveJobs(company, jobs) {
  const collection = firestore.collection(`${company}_jobs`);
  const batch = firestore.batch();

  jobs.forEach(job => {
    const jobDoc = collection.doc(job.jobId);
    batch.set(jobDoc, {
      ...job,
      foundAt: job.foundAt || new Date(),
      updatedAt: new Date()
    });
  });

  await batch.commit();
  console.log(`Saved ${jobs.length} jobs for ${company}`);
}

module.exports = { saveJobs };