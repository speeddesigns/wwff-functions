import express from 'express';
import { readdirSync } from 'fs';
import { join } from 'path';

const app = express();

app.use(express.json());

const port = 8080;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Handle Pub/Sub event
app.post('/', async (req, res) => {
    try {
        // Dynamically import and call all company-specific job fetching functions
        const companiesDir = join('../src', 'companies');
        const companyFiles = readdirSync(companiesDir);

        for (const file of companyFiles) {
            if (file.endsWith('.js')) {
                const module = await import(join(companiesDir, file));
                const jobFetchingFunction = Object.values(module).find(
                    (value) => typeof value === 'function' && value.name.startsWith('fetch')
                );
                if (jobFetchingFunction) {
                    await jobFetchingFunction();
                }
            }
        }

        res.status(200).send('Job capturing complete');
    } catch (error) {
        console.error('Error handling Pub/Sub event:', error);
        res.status(500).send('Error handling Pub/Sub event');
    }
});

export default app;
