// routes/customerRoutes.js
const express = require("express");
const router = express.Router();

// Auth middleware (JWT doğrulama)
const { authMiddleware } = require("../middlewares/authMiddleware");

const {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

// Sadece superadmin erişiminde:
router.post("/", authMiddleware, createCustomer);
router.get("/", authMiddleware, getAllCustomers);
router.get("/:id", authMiddleware, getCustomerById);
router.put("/:id", authMiddleware, updateCustomer);
router.delete("/:id", authMiddleware, deleteCustomer);

module.exports = router;
