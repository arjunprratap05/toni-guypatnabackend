const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment');

// 1. POST: Create a new booking
router.post('/book', appointmentController.createAppointment);

// 2. GET: Fetch available/booked time slots
router.get('/booked-slots/:stylistId/:date', appointmentController.getBookedSlots);

router.get('/bookings', appointmentController.getAllBookings);

// 4. POST: Verify Admin Password (Admin facing)
router.post('/admin/login', appointmentController.adminLogin);

router.patch('/bookings/:id/complete', appointmentController.markCompleted);

module.exports = router;