const mongoose = require("mongoose");

const servicesSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    currencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Currency",
      required: true,
    },
    serviceName: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      required: true,
    },
    validityDate: {
      type: Date,
      required: true,
    },
    serviceFee: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    isDeleted: { type: Boolean, default: false }, // Soft delete alanı
    lastEditBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Services", servicesSchema);
