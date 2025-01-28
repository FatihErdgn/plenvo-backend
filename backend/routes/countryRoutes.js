// routes/countryRoutes.js
const express = require("express");
const router = express.Router();

// Auth middleware (JWT doğrulama)
const { authMiddleware } = require("../middlewares/authMiddleware");

// Controller fonksiyonları
const {
  createCountry,
  getAllCountries,
  getCountryById,
  updateCountry,
  deleteCountry,
} = require("../controllers/countryController");

// Sadece superadmin erişiminde:
// create, read, update, delete
router.post("/", authMiddleware, createCountry);
router.get("/", authMiddleware, getAllCountries);
router.get("/:id", authMiddleware, getCountryById);
router.put("/:id", authMiddleware, updateCountry);
router.delete("/:id", authMiddleware, deleteCountry);

module.exports = router;
