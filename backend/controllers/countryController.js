// controllers/countryController.js
const Country = require("../models/Country");

// CREATE
exports.createCountry = async (req, res) => {
  try {
    const { countryKey, countryName } = req.body;
    const newCountry = new Country({ countryKey, countryName });
    await newCountry.save();
    return res.status(201).json(newCountry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Country creation failed" });
  }
};

// GET all
exports.getAllCountries = async (req, res) => {
  try {
    const countries = await Country.find();
    res.json(countries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
