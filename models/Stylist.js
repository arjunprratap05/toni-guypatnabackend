const mongoose = require('mongoose');

const stylistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    tier: { type: String, enum: ['Stylist', 'Top Stylist', 'Art Director'], default: 'Stylist' },
    specialties: [{ type: String }],
    isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Stylist', stylistSchema);