const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  countryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Country",
    required: true,
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic",
    required: true,
  },
  curenncyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Currency",
    required: true,
  },
  expenseCategory: {
    type: String,
    required: true,
  },
  expenseDescription: {
    type: String,
    required: true,
  },
  expenseKind: {
    type: String,
    enum: ["Fixed", "General"],
    required: true,
  },
  expenseAmount: {
    type: Number,
    required: true,
  },
  expenseDate: {
    type: Date,
    required: true,
  },
  isDeleted: { type: Boolean, default: false }, // Soft delete alanı
});

module.exports = mongoose.model("Expense", expenseSchema);
