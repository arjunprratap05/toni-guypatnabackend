const appointmentService = require('../services/appointments');
const whatsappService = require('../services/whatsapp'); // <-- 1. Import the WhatsApp service
const SalonStatus = require('../models/SalonStatus');

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

        // 2. Trigger WhatsApp Message Notifications (Client + Staff)
        try {
            // Send confirmation to the client
            await whatsappService.sendBookingConfirmation(userId, clientName, date, timeSlot);
            
            // Send real-time update to the salon staff
            if (typeof whatsappService.notifySalonStaff === 'function') {
                await whatsappService.notifySalonStaff(clientName, date, timeSlot);
            }
        } catch (waError) {
            // THIS LINE IS CRITICAL: It prints Meta's exact error message if anything fails
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

// Fetch all bookings for the Admin Dashboard
exports.getAllBookings = async (req, res) => {
    try {
        // Calls the service layer to fetch all appointments from MongoDB
        const bookings = await appointmentService.fetchAllBookings();
        res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching admin bookings:", error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
};

// Secure Admin Login Verification
exports.adminLogin = (req, res) => {
    const { email, password } = req.body;
    
    // Check both email and password against your secure environment variables
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        res.status(200).json({ success: true, message: 'Authenticated' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
};

exports.markCompleted = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Pass the ID to the service layer to handle the database update
        const updatedBooking = await appointmentService.markBookingCompleted(id);
        
        if (!updatedBooking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        
        res.status(200).json({ success: true, data: updatedBooking });
    } catch (error) {
        console.error("Error completing booking:", error);
        res.status(500).json({ error: 'Failed to update booking status' });
    }
};

// Silently create a back-dated or manual appointment
exports.createManualBooking = async (req, res) => {
    try {
        const bookingData = req.body;
        
        // Call a dedicated silent service
        const newAppointment = await appointmentService.createSilentBooking(bookingData);

        res.status(201).json({
            success: true,
            message: 'Manual entry saved successfully (No notifications sent).',
            data: newAppointment
        });
    } catch (error) {
        console.error("Error saving manual entry:", error);
        res.status(500).json({ success: false, error: 'Failed to save manual booking' });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // Gets 'in-progress' or 'completed' from React
        
        const updatedBooking = await appointmentService.updateBookingStatus(id, status);
        
        if (!updatedBooking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        
        res.status(200).json({ success: true, data: updatedBooking });
    } catch (error) {
        console.error("Error updating booking status:", error);
        res.status(500).json({ error: 'Failed to update booking status' });
    }
};

let salonStatus = {
    isForceClosed: false,
    reason: "",
    closeUntil: null 
};

exports.getSalonStatus = async (req, res) => {
    try {
        // Find the status document in the DB
        let status = await SalonStatus.findOne();
        
        // If it doesn't exist yet, create a default one
        if (!status) {
            status = await SalonStatus.create({ isForceClosed: false, reason: "", closeUntil: null });
        }

        // SMART AUTO-REOPEN LOGIC
        if (status.isForceClosed && status.closeUntil) {
            const today = new Date().toISOString().split('T')[0];
            if (today > status.closeUntil) {
                status.isForceClosed = false;
                status.reason = "";
                status.closeUntil = null;
                await status.save(); // Save the reopened status back to the DB
            }
        }

        res.json(status);
    } catch (error) {
        console.error("Error fetching global salon status:", error);
        res.status(500).json({ error: "Server error" });
    }
};

// Logic to UPDATE the global status in MongoDB
exports.updateSalonStatus = async (req, res) => {
    try {
        const { isForceClosed, reason, closeUntil } = req.body;
        
        let status = await SalonStatus.findOne();
        
        if (!status) {
            status = await SalonStatus.create({ isForceClosed, reason, closeUntil });
        } else {
            // Update existing document
            status.isForceClosed = isForceClosed;
            status.reason = reason;
            status.closeUntil = closeUntil;
            await status.save();
        }

        res.json({ success: true, isForceClosed: status.isForceClosed, reason: status.reason, closeUntil: status.closeUntil });
    } catch (error) {
        console.error("Error updating global salon status:", error);
        res.status(500).json({ error: "Server error" });
    }
};