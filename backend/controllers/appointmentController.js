const Appointment = require("../models/Appointment");
const Patient = require("../models/User");
const generateUniqueCode = require("../utils/uniqueAppointmentCode");

const createAppointment = async (req, res) => {
  const {
    name,
    email,
    phone,
    department,
    doctor,
    date,
    time,
    note = "",
  } = req.body;

  try {
    // Hasta bilgilerini kaydet veya mevcutsa getir
    let patient = await Patient.findOne({ email });

    if (!patient) {
      patient = await Patient.create({ name, email, phone });
    }

    // Benzersiz randevu kodu oluştur
    const uniqueCode = generateUniqueCode();

    // Randevu oluştur
    const appointment = await Appointment.create({
      department,
      doctor,
      date,
      time,
      patient: patient._id,
      uniqueCode,
      note,
    });

    // Hastanın randevu listesine ekle
    patient.appointments.push(appointment._id);
    await patient.save();

    res
      .status(201)
      .json({ message: "Randevu başarıyla oluşturuldu.", uniqueCode });
  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası.", error });
  }
};

const deleteAppointmentByPatient = async (req, res) => {
  const { uniqueCode, name } = req.body;

  try {
    // Randevuyu benzersiz kod ile bul
    const appointment = await Appointment.findOne({ uniqueCode }).populate(
      "patient"
    );

    if (!appointment) {
      return res.status(404).json({ message: "Randevu bulunamadı." });
    }

    if (appointment.patient.name !== name) {
      return res
        .status(403)
        .json({ message: "Bilgiler uyuşmuyor. Randevuyu silemezsiniz." });
    }

    // Randevuyu sil
    await Appointment.findByIdAndDelete(appointment._id);

    res.status(200).json({ message: "Randevu başarıyla silindi." });
  } catch (error) {
    console.error("Hata Detayı:", error); // Hata detayını günlüğe kaydet
    res.status(500).json({ message: "Sunucu hatası.", error: error.message });
  }
};

module.exports = { createAppointment, deleteAppointmentByPatient };
