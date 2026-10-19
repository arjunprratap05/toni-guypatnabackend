const mongoose = require('mongoose');

const salonStatusSchema = new mongoose.Schema({
    // We only need one document to track the whole salon
    isForceClosed: { type: Boolean, default: false },
    reason: { type: String, default: "" },
    closeUntil: { type: String, default: null } 
});

module.exports = mongoose.model('SalonStatus', salonStatusSchema);