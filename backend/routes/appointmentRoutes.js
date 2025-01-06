const express = require('express');
const { createAppointment, deleteAppointmentByPatient } = require('../controllers/appointmentController');

const router = express.Router();

router.post('/create', createAppointment);
router.delete('/delete', deleteAppointmentByPatient);

module.exports = router;
