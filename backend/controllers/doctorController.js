const Appointment = require('../models/Appointment');

const getAppointments = async (req, res) => {
    try {
        console.log('Token ile giriş yapan kullanıcı ID:', req.user.id);

        const appointments = await Appointment.find({ doctor: req.user.id })
            .populate('patient', 'name email phone')
            .sort({ date: 1, time: 1 });

        console.log('Bulunan randevular:', appointments);

        res.status(200).json(appointments);
    } catch (error) {
        console.error('Hata:', error);
        res.status(500).json({
            message: 'Sunucu hatası.',
            error: error.message || 'Belirsiz hata',
            stack: error.stack || 'Stack izlenemedi',
        });
    }
};

const getPastAppointments = async (req, res) => {
    try {
        const now = new Date();

        const pastAppointments = await Appointment.find({
            doctor: req.user.id,
            date: { $lt: now },
        })
            .populate('patient', 'name email phone')
            .sort({ date: -1, time: -1 });

        res.status(200).json(pastAppointments);
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.', error });
    }
};

const addNoteToAppointment = async (req, res) => {
    const { appointmentId, note } = req.body;

    try {
        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ message: 'Randevu bulunamadı.' });
        }

        // Doktorun sadece kendi randevusuna işlem yapmasını kontrol et
        if (appointment.doctor.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
        }

        appointment.note = note;
        await appointment.save();

        res.status(200).json({ message: 'Not başarıyla eklendi.', appointment });
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.', error });
    }
};

const uploadFileToAppointment = async (req, res) => {
    const { appointmentId } = req.body;
    const filePath = req.file.path;

    try {
        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ message: 'Randevu bulunamadı.' });
        }

        if (appointment.doctor.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
        }

        appointment.files = appointment.files || [];
        appointment.files.push(filePath);
        await appointment.save();

        res.status(200).json({ message: 'Dosya başarıyla yüklendi.', appointment });
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.', error });
    }
};

module.exports = {
    getAppointments,
    getPastAppointments,
    addNoteToAppointment,
    uploadFileToAppointment,
};
