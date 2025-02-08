// routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/serviceController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

// Kullanıcı CRUD ve şifre değiştirme
router.get(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant", "manager"]),
  serviceController.getServices
);
router.post(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  serviceController.createService
);
router.put(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  serviceController.updateService
);
router.delete(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  serviceController.softDeleteService
);

module.exports = router;
