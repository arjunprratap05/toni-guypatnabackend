const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment');

// 1. POST: Create a new booking
router.post('/book', appointmentController.createAppointment);

// 2. GET: Fetch available/booked time slots
router.get('/booked-slots/:stylistId/:date', appointmentController.getBookedSlots);

module.exports = router;