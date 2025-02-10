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

require("./jobs/reminderJob");
require("./jobs/updateAppointmentStatus");

// Express App Başlat
const app = express();

// CORS Ayarları
const allowedOrigins = [
  "http://localhost:3000", // Geliştirme ortamı (React frontend)
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
  res.send("Hospital Appointment System API is running...");
});

// **ÖNEMLİ**: MongoDB Bağlantısı Tamamlanmadan Express Başlatılmasın!
connectDB()
  .then(async () => {
    try {
      await require("./seed")();
      console.log("Seed işlemi tamam.");

      // **Tüm route'ları burada yükle**
      const authRoutes = require("./routes/authRoutes");
      app.use("/api/auth", authRoutes);

      const countryRoutes = require("./routes/countryRoutes");
      app.use("/api/countries", countryRoutes);

      const customerRoutes = require("./routes/customerRoutes");
      app.use("/api/customers", customerRoutes);

      const userRoutes = require("./routes/userRoutes");
      app.use("/api/users", userRoutes);

      const roleRoutes = require("./routes/roleRoutes");
      app.use("/api/roles", roleRoutes);

      const serviceRoutes = require("./routes/serviceRoutes");
      app.use("/api/services", serviceRoutes);

      const appointmentRoutes = require("./routes/appointmentRoutes");
      app.use("/api/appointments", appointmentRoutes);

      const paymentRoutes = require("./routes/paymentRoutes");
      app.use("/api/payments", paymentRoutes);

      const dashboardRoutes = require("./routes/dashboardRoutes");
      app.use("/api/dashboard", dashboardRoutes);

      const reminderRoutes = require("./routes/reminderRoutes");
      app.use("/api/reminders", reminderRoutes);

      const expenseRoutes = require("./routes/expenseRoutes");
      app.use("/api/expenses", expenseRoutes);

      const currencyRoutes = require("./routes/currencyRoutes");
      app.use("/api/currencies", currencyRoutes);

      // Tüm rotalardan sonra error handler
      app.use(errorHandler);

      app._router.stack.forEach((r) => {
        if (r.route && r.route.path) {
          console.log(`✅ Route: ${r.route.path}`);
        }
      });

      // **Server MongoDB bağlantısı tamamlandıktan sonra başlatılmalı**
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
    } catch (err) {
      console.error("Seed işlemi sırasında hata:", err);
    }
  })
  .catch((err) => {
    console.error("MongoDB bağlantı hatası:", err);
  });
