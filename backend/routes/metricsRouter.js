// routes/metrics.js
const express = require("express");
const router = express.Router();
const metricsController = require("../controllers/dashboardController");

router.get("/", metricsController.getMetrics);

module.exports = router;
