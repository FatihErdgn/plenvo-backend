// routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

// Kullanıcı CRUD ve şifre değiştirme
router.get(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant", "manager"]),
  expenseController.getExpenses
);
router.post(
  "/",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  expenseController.createExpense
);
router.put(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  expenseController.updateExpense
);
router.delete(
  "/:id",
  authMiddleware,
  checkPermission(["admin", "superadmin", "consultant"]),
  expenseController.softDeleteExpense
);

module.exports = router;
