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
const seedSuperadmin = require("./seed");

// Uygulamayı başlat
const app = express();

// MongoDB Bağlantısı
connectDB().then(async () => {
  try {
    await seedSuperadmin();
    console.log("Seed işlemi tamam.");
  } catch (err) {
    console.error("Seed işlemi sırasında hata:", err);
  }
});

const allowedOrigins = [
  "http://localhost:3000", // Geliştirme ortamı (React frontend)
  /\.plenvo\.com$/, // *.yourdomain.com şeklindeki tüm subdomainler için izin
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
      callback(null, false); // JSON hata döndürmek için bu satır daha iyi
    }
  },
  credentials: true, // Cookie paylaşımı için
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(cookieParser());

app.use(bodyParser.json());
app.use("/api/", apiLimiter);

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev")); // Geliştirme sırasında detaylı loglar
}

// Basit bir test route
app.get("/", (req, res) => {
  res.send("Hospital Appointment System API is running...");
});

// Server'ı başlat
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

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

// const appointmentRoutes = require("./routes/appointmentRoutes");
// app.use("/api/appointments", appointmentRoutes);

const expenseRoutes = require("./routes/expenseRoutes");
app.use("/api/expenses", expenseRoutes);

const currencyRoutes = require("./routes/currencyRoutes");
app.use("/api/currencies", currencyRoutes);

// Tüm rotalardan sonra error handler
app.use(errorHandler);
