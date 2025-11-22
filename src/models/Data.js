const mongoose = require('mongoose');

// Use strict: false to allow any fields from the JSON data
// This matches the Analytics schema from the main application
const AnalyticsSchema = new mongoose.Schema({}, {
    strict: false,
    timestamps: true
});

// Force collection name to 'analytics' (3rd parameter)
module.exports = mongoose.model('Analytics', AnalyticsSchema, 'analytics');

