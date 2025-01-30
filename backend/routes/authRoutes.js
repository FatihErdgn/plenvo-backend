// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { resolveCustomer } = require("../middlewares/tenantMiddleware");

// Login: subdomain'i çözmek için resolveCustomer middleware'i kullan
router.post("/login", resolveCustomer, authController.login);
router.post("/logout", resolveCustomer, authController.logout);

module.exports = router;
