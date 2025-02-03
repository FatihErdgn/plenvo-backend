// routes/currencyRoutes.js
const express = require("express");
const router = express.Router();
const currencyController = require("../controllers/currencyController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

router.post("/", authMiddleware, checkPermission(["superadmin"]), currencyController.createCurrency);
router.get("/", authMiddleware, checkPermission(["superadmin", "admin"]), currencyController.getCurrencies);
router.get("/:id", authMiddleware, checkPermission(["superadmin", "admin"]), currencyController.getCurrencyById);
router.delete("/:id", authMiddleware, checkPermission(["superadmin"]), currencyController.deleteCurrency);

module.exports = router;
