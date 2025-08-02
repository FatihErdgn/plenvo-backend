// routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

// Belirli bir randevuya ait ödemeleri getiren endpoint.
// Route örneği: GET /api/payments/appointment/:appointmentId
router.get(
  "/appointment/:appointmentId",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  paymentController.getPaymentsByAppointment
);

// Belirli bir hafta için tüm randevuların ödeme bilgilerini getiren endpoint.
// Route örneği: GET /api/payments/week?weekStart=2024-01-15&doctorId=...
router.get(
  "/week",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  paymentController.getPaymentsByWeek
);

// Yeni ödeme oluşturma endpoint'i
router.post(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  paymentController.createPayment
);

// Ödeme güncelleme endpoint'i
router.put(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  paymentController.updatePayment
);

// Ödeme soft delete endpoint'i
router.delete(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  paymentController.softDeletePayment
);

module.exports = router;
