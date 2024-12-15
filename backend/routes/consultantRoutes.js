const express = require('express');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { getAllAppointments } = require('../controllers/consultantController');

const router = express.Router();

router.get('/appointments', protect, authorize('consultant'), getAllAppointments);

module.exports = router;
