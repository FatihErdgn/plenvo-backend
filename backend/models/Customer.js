const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  countryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Country",
    required: false,
  },
  countryName: { type: String, required: false },
  customerDomain: { type: String, required: true },
  appMainColor: { type: String },
  appSecondaryColor: { type: String },
  customerType: { type: String },
  isSmsActive: { type: Boolean, default: false },
  smsApiKey: { type: String }, // SMS için gerekli API anahtarı
  smsSenderId: { type: String }, // SMS gönderici adı
  isDeleted: { type: Boolean, default: false }, // Soft delete alanı
});

module.exports = mongoose.model("Customer", customerSchema);
