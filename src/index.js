const cron = require('node-cron');
const http = require('http');
const connectDB = require('./config/db');
const redisClient = require('./config/redis');
const syncData = require('./jobs/sync');
require('dotenv').config();

// Create a simple server to satisfy Railway's port binding requirement
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Redis-Mongo Sync Service is running');
});

server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    // Ensure Redis is connected
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
});

// Connect to MongoDB
connectDB();

// Schedule the task to run every hour
// Cron syntax: Minute Hour Day Month DayOfWeek
// '0 * * * *' = Every hour at minute 0
//0 0 * * * - 12 AM 
cron.schedule('0 * * * *', () => {
    console.log('Running scheduled sync job at ' + new Date().toISOString());
    syncData();
});

console.log('Cron job scheduler started. Waiting for next minutes...');

// For testing purposes, you can uncomment the line below to run immediately on startup
// syncData();
