// routes/metrics.js
const express = require("express");
const router = express.Router();
const metricsController = require("../controllers/dashboardController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { checkPermission } = require("../middlewares/checkPermission");

router.get("/",authMiddleware, checkPermission(["admin", "manager"]), metricsController.getMetrics);

module.exports = router;
