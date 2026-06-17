const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    clientName: { type: String, required: true }, // Can link to a User model later
    stylistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stylist', required: false },
    services: [{ 
        serviceId: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true }
    }],
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    timeSlot: { type: String, required: true }, // Format: HH:MM (e.g., "14:30")
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
    totalAmount: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);