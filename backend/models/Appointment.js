const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema({
  department: {
    type: String,
    required: true,
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "cancelled"],
    default: "pending",
  },
  uniqueCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  note: {
    type: String, // Notları metin olarak depoluyoruz
  },
  files: [
    {
      type: String, // Yüklenen dosyaların dosya yollarını tutuyoruz
    },
  ],
});

module.exports = mongoose.model("Appointment", AppointmentSchema);
