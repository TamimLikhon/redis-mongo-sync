const cron = require('node-cron');
const connectDB = require('./config/db');
const syncData = require('./jobs/sync');
require('dotenv').config();

// Connect to MongoDB
connectDB();

// Schedule the task to run every hour
// Cron syntax: Minute Hour Day Month DayOfWeek
// '0 * * * *' = Every hour at minute 0
cron.schedule('* * * * *', () => {
    console.log('Running scheduled sync job at ' + new Date().toISOString());
    syncData();
});

console.log('Cron job scheduler started. Waiting for next hour...');

// For testing purposes, you can uncomment the line below to run immediately on startup
// syncData();
