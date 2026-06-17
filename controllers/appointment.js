const appointmentService = require('../services/appointments');
const whatsappService = require('../services/whatsapp'); // <-- 1. Import the WhatsApp service

exports.createAppointment = async (req, res, next) => {
    try {
        const { userId, clientName, stylistId, services, date, timeSlot } = req.body;

        // NEW LOGIC: Intercept the generic booking
        const resolvedStylistId = stylistId === 'any' ? null : stylistId;

        // 1. Trigger business logic from Service layer to save to MongoDB
        const newAppointment = await appointmentService.bookAppointment({
            userId, // This contains the clientPhone sent from your frontend
            clientName,
            stylistId: resolvedStylistId,
            services,
            date,
            timeSlot
        });

        // 2. Trigger WhatsApp Message Notification
        try {
            await whatsappService.sendBookingConfirmation(userId, clientName, date, timeSlot);
        } catch (waError) {
            // THIS LINE IS CRITICAL: It prints Meta's exact error message (e.g., "Number not verified")
            console.error("Meta Error:", waError.response?.data || waError.message);
            console.error("WhatsApp notification failed, but booking succeeded.");
        }

        // 3. Respond to the client
        return res.status(201).json({
            success: true,
            message: 'Appointment reserved successfully!',
            data: newAppointment
        });
    } catch (error) {
        // 4. Forward unexpected or validation errors to global handler in server.js
        next(error); 
    }
};

exports.getBookedSlots = async (req, res) => {
    try {
        // Extract the parameters from the URL (e.g., 'any' and '2026-06-05')
        const { stylistId, date } = req.params;

        // Call the service function we created earlier
        const bookedSlots = await appointmentService.fetchBookedSlots(stylistId, date);

        // Send the array of booked slots back to React
        res.status(200).json({
            success: true,
            data: bookedSlots
        });
    } catch (error) {
        console.error("Error fetching booked slots:", error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch availability'
        });
    }
};