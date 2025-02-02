const mongoose = require("mongoose");

// actions alt nesnesi şeması
const actionsSchema = new mongoose.Schema(
  {
    edit: { type: Boolean, default: false },
    view: { type: Boolean, default: false },
  },
  { _id: false }
);

const servicesSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic",
    required: true,
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
  serviceDescription: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  actions: actionsSchema,
  isDeleted: { type: Boolean, default: false }, // Soft delete alanı
  lastEditBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lastEditDate: { type: Date, required: true },
});

module.exports = mongoose.model("Services", servicesSchema);
