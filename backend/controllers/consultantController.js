const Appointment = require('../models/Appointment');

const getAllAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find()
            .populate('patient', 'name email phone')
            .populate('doctor', 'username')
            .sort({ date: 1, time: 1 });

        res.status(200).json(appointments);
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.', error });
    }
};

module.exports = { getAllAppointments };
