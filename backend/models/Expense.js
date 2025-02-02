const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
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
  currencyId: {
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
  lastEditBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lastEditDate: { type: Date, required: true },
});

module.exports = mongoose.model("Expense", expenseSchema);
