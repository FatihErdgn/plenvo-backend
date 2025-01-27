// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

// Kullanıcı CRUD ve şifre değiştirme
router.post("/", authMiddleware, checkPermission(["admin", "superadmin"]), userController.createUser);
router.put("/:id", authMiddleware, checkPermission(["admin", "superadmin"]), userController.updateUser);
router.delete("/:id", authMiddleware, checkPermission("admin"), userController.deleteUser);
router.get("/", authMiddleware, checkPermission(["manager", "admin", "superadmin"]), userController.getUsers);
router.post("/change-password", authMiddleware, userController.changePassword);

module.exports = router;
