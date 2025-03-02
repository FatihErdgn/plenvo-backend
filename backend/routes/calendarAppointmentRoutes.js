// routes/calendarAppointmentRoutes.js
const express = require("express");
const router = express.Router();
const calendarScheduleController = require("../controllers/calendarAppointmentController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

// GET /calendar-schedule
// => Sadece okuyabilme: ["admin", "superadmin", "consultant", "manager", "doctor"]
router.get(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant", "manager", "doctor"]),
  calendarScheduleController.getCalendarAppointments
);

// POST /calendar-schedule
// => Randevu oluşturma yetkisi: ["admin", "superadmin", "consultant", "manager"]
router.post(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant", "manager"]),
  calendarScheduleController.createCalendarAppointment
);

// PUT /calendar-schedule/:id
// => Randevu güncelleme yetkisi: ["admin", "superadmin", "consultant", "manager"]
router.put(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant", "manager"]),
  calendarScheduleController.updateCalendarAppointment
);

// DELETE /calendar-schedule/:id
// => Randevu silme yetkisi: ["admin", "superadmin", "consultant", "manager"]
router.delete(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant", "manager"]),
  calendarScheduleController.deleteCalendarAppointment
);

module.exports = router;
