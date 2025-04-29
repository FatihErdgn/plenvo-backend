require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const express = require("express");
const connectDB = require("./config/database");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const errorHandler = require("./middlewares/errorHandler");
const apiLimiter = require("./middlewares/rateLimiter");
const morgan = require("morgan");

// require("./jobs/reminderJob");
require("./jobs/updateAppointmentStatus");
require('./jobs/salaryExpensesJob'); // Yeni eklenen cron job dosyası
require('./jobs/appointmentReminderJob'); // WhatsApp randevu hatırlatma görevi

// Express App Başlat
const app = express();
app.set("trust proxy", 1);

// CORS Ayarları
const allowedOrigins = [
  "http://localhost:3000",
  /\.plenvo\.app$/, // *.plenvo.app için izin
  "https://api.plenvo.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      allowedOrigins.some((allowed) =>
        allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
      )
    ) {
      callback(null, true);
    } else {
      console.warn(`CORS Engellendi: ${origin}`);
      callback(new Error("CORS hatası!"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(bodyParser.json());
app.use("/api/", apiLimiter);

// Geliştirme Ortamı İçin Loglama
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Basit Test Route
app.get("/", (req, res) => {
  res.send("✅ Hospital Appointment System API is running...");
});

// **ÖNEMLİ: MongoDB Bağlantısı Tamamlanmadan Express Route'lar Yüklenmesin!**
connectDB().then(async () => {
  try {
    await require("./seed")();
    console.log("Seed işlemi tamam.");

    // **TÜM ROUTE'LARI BURADA YÜKLE**
    app.use("/api/auth", require("./routes/authRoutes"));
    app.use("/api/countries", require("./routes/countryRoutes"));
    app.use("/api/customers", require("./routes/customerRoutes"));
    app.use("/api/users", require("./routes/userRoutes"));
    app.use("/api/roles", require("./routes/roleRoutes"));
    app.use("/api/services", require("./routes/serviceRoutes"));
    app.use("/api/appointments", require("./routes/appointmentRoutes"));
    app.use("/api/payments", require("./routes/paymentRoutes"));
    app.use("/api/dashboard", require("./routes/dashboardRoutes"));
    app.use("/api/reminders", require("./routes/reminderRoutes"));
    app.use("/api/expenses", require("./routes/expenseRoutes"));
    app.use("/api/currencies", require("./routes/currencyRoutes"));
    app.use("/api/calendar-appointments", require("./routes/calendarAppointmentRoutes"));

    // **Tüm route'ları konsola yazdıralım**
    console.log("✅ Yüklenen Route'lar:");
    app._router.stack.forEach((r) => {
      if (r.route && r.route.path) {
        console.log(`🔹 Route: ${r.route.path}`);
      }
    });

    // Hata Yakalama Middleware
    app.use(errorHandler);

    // **Server MongoDB bağlantısı tamamlandıktan sonra başlatılmalı**
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

  } catch (err) {
    console.error("❌ Seed işlemi sırasında hata:", err);
  }
}).catch((err) => {
  console.error("❌ MongoDB bağlantı hatası:", err);
});
