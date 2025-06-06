// models/Payment.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  currencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Currency",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  serviceId: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Services",
    required: true,
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    required: true,
  },
  paymentMethod: {
    type: String,
    required: true,
  },
  paymentAmount: {
    type: Number,
    required: true,
  },
  paymentDate: {
    type: Date,
    required: true,
  },
  paymentStatus: {
    type: String,
    required: true,
  },
  paymentDescription: {
    type: String,
    required: false,
  },
  // Yeni eklenen alanlar
  serviceFee: {
    type: Number,
    required: true,
  },
  serviceDescription: {
    type: String,
    required: true,
  },
  // Ödeme periyodu alanları
  paymentPeriod: {
    type: String,
    enum: ["single", "monthly", "quarterly", "biannual"],
    default: "single" // Tek seferlik ödeme varsayılan
  },
  periodEndDate: {
    type: Date,
    default: null // Periyot sonu tarihi
  },
  isDeleted: { type: Boolean, default: false }, // Soft delete alanı
});

module.exports = mongoose.model("Payment", paymentSchema);
