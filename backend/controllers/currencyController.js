// controllers/currencyController.js
const Currency = require("../models/Currency");

// Para birimi oluşturma
exports.createCurrency = async (req, res) => {
  try {
    const { currencyName } = req.body;

    // Aynı isimde rol var mı?
    const existingCurrency = await Currency.findOne({ currencyName });
    if (existingCurrency) {
      return res.status(400).json({ success: false, message: "Bu para birimi zaten mevcut." });
    }

    const newCurrency = await Currency.create({ currencyName });
    res.status(201).json({ success: true, data: newCurrency });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Para birimi oluşturulamadı." });
  }
};

// Tüm rolleri listeleme
exports.getCurrencies = async (req, res) => {
  try {
    const currency = await Currency.find();
    res.status(200).json({ success: true, data: currencies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Para birimi getirilemedi." });
  }
};

// Tekil rol görüntüleme
exports.getCurrencyById = async (req, res) => {
  try {
    const { id } = req.params;
    const currency = await Currency.findById(id);
    if (!currency) {
      return res.status(404).json({ success: false, message: "Para birimi bulunamadı." });
    }
    res.status(200).json({ success: true, data: currency });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Para birimi getirilemedi." });
  }
};

// Rol silme
exports.deleteCurrency = async (req, res) => {
  try {
    const { id } = req.params;
    const currency = await Currency.findById(id);
    if (!currency) {
      return res.status(404).json({ success: false, message: "Para birimi bulunamadı." });
    }
    await currency.deleteOne();
    res.status(200).json({ success: true, message: "Para birimi başarıyla silindi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Para birimi silinemedi." });
  }
};
