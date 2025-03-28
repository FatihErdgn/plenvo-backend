// models/CalendarAppointment.js
const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const calendarAppointmentSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  bookingId: { type: String, required: true },
  dayIndex: { type: Number, required: true }, // 0-6 (Pazartesi-Pazar)
  timeIndex: { type: Number, required: true }, // 0-11 (09:00-10:00 -> 0, 10:00-11:00 -> 1, ...)
  appointmentDate: { type: Date }, // Randevu tarihi
  participants: [participantSchema],
  description: { type: String, default: "" }, // Yeni eklenen açıklama alanı
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CalendarAppointment", calendarAppointmentSchema);
