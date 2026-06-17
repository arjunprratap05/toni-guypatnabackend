const Appointment = require('../models/Appointment');
const Stylist = require('../models/Stylist');

// Import the email function. Ensure the path to the utils folder is correct!
const { sendBookingNotification } = require('../utils/emailService');

/**
 * Business Logic to create a fresh booking
 */
exports.bookAppointment = async (bookingData) => {
    const { userId, clientName,stylistId, services, date, timeSlot } = bookingData;

    // Rule 1: Validate stylist existence and status
    if (stylistId) {
        const stylist = await Stylist.findById(stylistId);
        if (!stylist || !stylist.isAvailable) {
            const error = new Error('Selected stylist is unavailable or does not exist.');
            error.statusCode = 400;
            throw error;
        }
    }

    // Rule 2: Prevent double-booking
    if (stylistId) {
        const existingBooking = await Appointment.findOne({
            stylistId,
            date,
            timeSlot,
            status: { $ne: 'cancelled' } 
        });

        if (existingBooking) {
            const error = new Error('This time slot has already been claimed for this artist.');
            error.statusCode = 409; 
            throw error;
        }
    }

    // Rule 3: Compute final basket price
    const totalAmount = services.reduce((sum, item) => sum + item.price, 0);

    // Rule 4: Setup the Database Record
    const appointment = new Appointment({
        userId,
        clientName,
        stylistId, 
        services,
        date,
        timeSlot,
        totalAmount,
        status: 'confirmed' 
    });

    // --- CRITICAL ORDER OF OPERATIONS ---

    // 1. FIRST: Save to MongoDB Atlas
    const savedAppointment = await appointment.save();

    // 2. THEN: Trigger the email notification in the background
    // We pass the saved record to the email function. 
    // We do NOT use 'await' here so it doesn't slow down the user's booking experience.
    sendBookingNotification(savedAppointment).catch(err => {
        console.error("Email trigger failed, but booking was saved.", err);
    });

    // 3. FINALLY: Return the saved data to the controller
    return savedAppointment;
};

/**
 * Business Logic to extract all unavailable slots for a stylist on a specific day
 */
exports.fetchBookedSlots = async (stylistId, date) => {
    if (!stylistId || stylistId === 'any' || stylistId === 'null') {
        return []; 
    }

    const appointments = await Appointment.find({
        stylistId,
        date,
        status: { $ne: 'cancelled' }
    }).select('timeSlot');

    return appointments.map(app => app.timeSlot);
};