const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  countryId: { type: mongoose.Schema.Types.ObjectId, ref: "Country", required: true },
  customerDomain: { type: String, required: true },
  appMainColor: { type: String },
  appSecondaryColor: { type: String },
  customerType: { type: String },
  isDeleted: { type: Boolean, default: false }, // Soft delete alanı
});

module.exports = mongoose.model("Customer", customerSchema);
