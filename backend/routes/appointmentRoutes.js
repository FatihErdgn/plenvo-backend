// routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const appointmentController = require("../controllers/appointmentController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

// Kullanıcı CRUD ve şifre değiştirme
router.get(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant", "manager"]),
  appointmentController.getAppointments
);
router.post(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  appointmentController.createAppointment
);
router.put(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  appointmentController.updateAppointment
);
router.delete(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  appointmentController.softDeleteAppointment
);

module.exports = router;
