const mongoose = require("mongoose");

const countrySchema = new mongoose.Schema({
  countryKey: {
    type: String,
    required: true,
    unique: true,
  },
  countryName: {
    type: String,
    required: true,
  }
});

module.exports = mongoose.model("Country", countrySchema);
