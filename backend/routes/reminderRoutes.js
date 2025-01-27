const express = require("express");
const { sendReminders } = require("../controllers/reminderController");
const { checkPermission } = require("../middlewares/checkPermission");

const router = express.Router();

// Hatırlatma gönderme endpoint'i
router.post(
  "/send",
  checkPermission(["admin", "consultant"]),
  async (req, res) => {
    try {
      await sendReminders();
      res.status(200).json({ message: "Hatırlatmalar başarıyla gönderildi." });
    } catch (error) {
      res.status(500).json({ message: "Hatırlatma gönderim hatası.", error });
    }
  }
);

module.exports = router;
