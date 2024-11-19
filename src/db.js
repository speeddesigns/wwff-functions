import { Firestore } from '@google-cloud/firestore';

export const db = new Firestore();

// Fetch all jobs for a given company with enhanced error handling
export async function fetchOpenJobs(company) {
  try {
    console.log(`Fetching jobs for ${company}`);

    const collectionRef = db.collection(company);
    const querySnapshot = await retryOperation(
      () => collectionRef.get(),
      { 
        maxRetries: 3, 
        baseDelay: 1000 
      }
    );

    const jobs = {};
    const invalidJobs = [];

    querySnapshot.forEach(doc => {
      const jobData = doc.data();
      
      try {
        // Validate job data during fetch
        const validatedJob = validateJobData({
          ...jobData,
          firestoreDocId: doc.id
        });

        jobs[validatedJob.jobId] = validatedJob;
      } catch (validationError) {
        console.warn('Skipping invalid job during fetch', {
          jobId: jobData.jobId,
          error: validationError.message
        });
        invalidJobs.push({
          jobData,
          error: validationError.message
        });
      }
    });

    if (invalidJobs.length > 0) {
      console.error('Some jobs were invalid during fetch', {
        company,
        invalidJobCount: invalidJobs.length
      });
    }

    console.log(`Fetched ${Object.keys(jobs).length} valid jobs for ${company}`, {
      validJobCount: Object.keys(jobs).length,
      invalidJobCount: invalidJobs.length
    });

    return jobs;
  } catch (error) {
    console.error(`Error fetching jobs for ${company}`, {
      error: error.message,
      stack: error.stack
    });
    throw new JobFetchError(`Failed to fetch jobs for ${company}`, { 
      company, 
      originalError: error 
    });
  }
}

// Update jobs by adding new roles, reopening existing ones, and updating changed details
export async function updateJobsWithOpenCloseLogic(company, fetchedJobs = []) {
  try {
    console.log(`Checking jobs for updates for ${company}`);

    if (!fetchedJobs || fetchedJobs.length === 0) {
      console.warn('No jobs fetched to update');
      return;
    }

    const batch = db.batch();
    const now = Firestore.Timestamp.now();

    // Step 1: Fetch all jobs from the database
    const existingJobs = await fetchOpenJobs(company);

    // Validate all fetched jobs before processing
    const validatedJobs = fetchedJobs.map(validateJobData);

    // Step 2: Process each fetched job
    const updates = [];
    const errors = [];

    validatedJobs.forEach(job => {
      const existingJob = existingJobs[job.jobId];
      let jobRef;

      try {
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
          console.debug(`Updating lastSeen for job ${job.jobId}`);
        }

        batch.set(jobRef, jobData, { merge: true });
        updates.push(job);
      } catch (updateError) {
        console.error(`Error processing job ${job.jobId}`, {
          error: updateError.message,
          job
        });
        errors.push({
          jobId: job.jobId,
          error: updateError.message
        });
      }
    });

    // Step 3: Mark jobs as closed if they're not in fetchedJobs
    const fetchedJobIds = new Set(validatedJobs.map(job => job.jobId));
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

    // Step 4: Commit batch update with retry mechanism
    await retryOperation(
      () => batch.commit(),
      { 
        maxRetries: 3, 
        baseDelay: 1500 
      }
    );

    console.log(`Jobs successfully updated for ${company}`, {
      updatedJobCount: updates.length,
      errorCount: errors.length
    });

    if (errors.length > 0) {
      throw new JobFetchError('Some jobs failed to update', {
        company,
        errors
      });
    }
  } catch (error) {
    console.error(`Error updating jobs for ${company}`, {
      error: error.message,
      stack: error.stack
    });
    throw new JobFetchError(`Failed to update jobs for ${company}`, { 
      company, 
      originalError: error 
    });
  }
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
