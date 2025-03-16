// migrateBookingId.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const CalendarAppointment = require("../models/CalendarAppointment");
require("dotenv").config({
  path: `../.env.${process.env.NODE_ENV || "development"}`,
});
/**
 * Katılımcı isimlerini normalize eder: 
 * - Her ismi lowercase yapar,
 * - trim eder,
 * - alfabetik sıraya koyup birleştirir.
 */
function normalizeParticipants(participants) {
  if (!participants || !Array.isArray(participants)) return "";
  return participants
    .map((p) => p.name.toLowerCase().trim())
    .sort()
    .join(";");
}

async function addBookingIdToPastAppointments() {
  try {
    // bookingId alanı olmayan tüm randevuları getir
    const appointments = await CalendarAppointment.find({
      bookingId: { $exists: false },
    });
    console.log(`BookingId'si olmayan ${appointments.length} randevu bulundu.`);

    // Aynı doctorId ve normalized participant names'e göre gruplama yap
    const groups = {};
    appointments.forEach((appointment) => {
      const normalized = normalizeParticipants(appointment.participants);
      const key = `${appointment.doctorId.toString()}_${normalized}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(appointment);
    });

    // Her grup için yeni bir bookingId oluştur ve gruptaki tüm randevulara ata
    for (const key in groups) {
      const group = groups[key];
      const newBookingId = uuidv4();
      const ids = group.map((appt) => appt._id);
      await CalendarAppointment.updateMany(
        { _id: { $in: ids } },
        { bookingId: newBookingId }
      );
      console.log(`Grup ${key} için bookingId atandı: ${newBookingId}`);
    }

    console.log("Migration tamamlandı.");
  } catch (err) {
    console.error("Migration hatası:", err);
  }
}

// MongoDB bağlantı string'inizi buraya girin
const mongoURI = process.env.DB_URI;

mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB'ye bağlandı.");
    addBookingIdToPastAppointments().then(() => {
      mongoose.disconnect();
    });
  })
  .catch((err) => {
    console.error("MongoDB bağlantı hatası:", err);
  });
