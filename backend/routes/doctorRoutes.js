const express = require('express');
const {
    getAppointments,
    getPastAppointments,
    addNoteToAppointment,
    uploadFileToAppointment,
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/fileUpload');

const router = express.Router();

router.get('/appointments', protect, authorize('doctor'), getAppointments);
router.get('/appointments/past', protect, authorize('doctor'), getPastAppointments);
router.post('/appointments/note', protect, authorize('doctor'), addNoteToAppointment);
router.post('/appointments/file', protect, authorize('doctor'), upload.single('file'), uploadFileToAppointment);

module.exports = router;
