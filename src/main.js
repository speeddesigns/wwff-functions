import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

const port = 8080;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Handle Pub/Sub event
app.post('/', async (req, res) => {
    try {
        // Dynamically load and execute the job fetching functions for each company
        const companiesDir = path.join(__dirname, 'companies');
        const files = fs.readdirSync(companiesDir);

        for (const file of files) {
            if (file.endsWith('.js')) {
                const companyName = path.basename(file, '.js');
                const functionName = `fetch${companyName.replace(/(\w)(\w*)/g, (_, p1, p2) => p1.toUpperCase() + p2.toLowerCase())}Jobs`;
                const filePath = path.join(companiesDir, file);
                const { [functionName]: fetchCompanyJobs } = await import(filePath);
                await fetchCompanyJobs();
            }
        }

        res.status(200).send('Job capturing complete');
    } catch (error) {
        console.error('Error handling Pub/Sub event:', error);
        res.status(500).send('Error handling Pub/Sub event');
    }
});

export default app;
