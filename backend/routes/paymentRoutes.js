// routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

// // Kullanıcı CRUD ve şifre değiştirme
// router.get(
//   "/",
//   authMiddleware,
//   checkPermission(["admin", "superadmin", "consultant", "manager"]),
//   paymentController.getAllPayments
// );
router.post(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  paymentController.createPayment
);
router.put(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  paymentController.updatePayment
);
router.delete(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  paymentController.softDeletePayment
);

module.exports = router;
