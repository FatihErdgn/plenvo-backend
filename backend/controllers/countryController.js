// controllers/countryController.js

const Country = require("../models/Country");

/**
 * Yeni bir ülke kaydı oluşturma
 */
exports.createCountry = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const { countryKey, countryName } = req.body;

    // countryKey eşsiz olacağı için, varsa duplicate kontrolü ekleyebilirsin
    // const existing = await Country.findOne({ countryKey });
    // if (existing) {
    //   return res.status(400).json({ success: false, message: "Bu countryKey zaten var." });
    // }

    const newCountry = new Country({
      countryKey,
      countryName,
    });
    await newCountry.save();

    res.status(201).json({ success: true, message: "Country başarıyla oluşturuldu." });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Country oluşturulamadı.", error: err.message });
  }
};

/**
 * Tüm ülkeleri listeleme
 */
exports.getAllCountries = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const countries = await Country.find();
    res.status(200).json({ success: true, data: countries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Ülkeler getirilemedi." });
  }
};

/**
 * Tek bir ülkenin detayını getirme
 */
exports.getCountryById = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const { id } = req.params;
    const country = await Country.findById(id);
    if (!country) {
      return res.status(404).json({ success: false, message: "Ülke bulunamadı." });
    }
    res.status(200).json({ success: true, data: country });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Ülke getirilemedi." });
  }
};

/**
 * Ülke güncelleme
 */
exports.updateCountry = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const { id } = req.params;
    const { countryKey, countryName } = req.body;
    const country = await Country.findById(id);
    if (!country) {
      return res.status(404).json({ success: false, message: "Ülke bulunamadı." });
    }

    // Gelen verileri güncelle
    if (countryKey) country.countryKey = countryKey;
    if (countryName) country.countryName = countryName;

    await country.save();
    res.status(200).json({ success: true, message: "Ülke başarıyla güncellendi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Ülke güncellenemedi." });
  }
};

/**
 * Ülke silme
 */
exports.deleteCountry = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const { id } = req.params;
    const country = await Country.findById(id);
    if (!country) {
      return res.status(404).json({ success: false, message: "Ülke bulunamadı." });
    }

    await country.deleteOne();
    res.status(200).json({ success: true, message: "Ülke başarıyla silindi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Ülke silinemedi." });
  }
};
