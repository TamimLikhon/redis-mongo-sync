const mongoose = require('mongoose');

const DataSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    syncedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Data', DataSchema);
