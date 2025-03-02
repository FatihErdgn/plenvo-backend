// routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

// Kullanıcı CRUD ve şifre değiştirme
router.get(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "manager","doctor"]),
  dashboardController.getDashboardData
);

module.exports = router;