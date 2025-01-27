// routes/roleRoutes.js
const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

router.post("/", authMiddleware, checkPermission(["superadmin"]), roleController.createRole);
router.get("/", authMiddleware, checkPermission(["superadmin", "admin"]), roleController.getRoles);
router.get("/:id", authMiddleware, checkPermission(["superadmin", "admin"]), roleController.getRoleById);
router.delete("/:id", authMiddleware, checkPermission(["superadmin"]), roleController.deleteRole);

module.exports = router;
