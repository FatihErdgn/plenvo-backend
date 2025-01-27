require("dotenv").config();
const express = require("express");
const connectDB = require("./config/database");
const cors = require("cors");
const bodyParser = require("body-parser");
const errorHandler = require("./middlewares/errorHandler");
const apiLimiter = require("./middlewares/rateLimiter");
const morgan = require("morgan");
require("./jobs/reminderJob");
const seedSuperadmin = require("./seed");

// Uygulamayı başlat
const app = express();

// MongoDB Bağlantısı
connectDB();

seedSuperadmin()
  .then(() => console.log("Seed işlem tamam."))
  .catch((err) => console.log("Seed hata:", err));

// Middleware
app.use(cors());
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

const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

const roleRoutes = require("./routes/roleRoutes");
app.use("/api/roles", roleRoutes);

// const appointmentRoutes = require('./routes/appointmentRoutes');
// app.use('/api/appointments', appointmentRoutes);

// const adminRoutes = require('./routes/adminRoutes');
// app.use('/api/admin', adminRoutes);

// const doctorRoutes = require('./routes/doctorRoutes');
// app.use('/api/doctor', doctorRoutes);

// const consultantRoutes = require('./routes/consultantRoutes');
// app.use('/api/consultant', consultantRoutes);

const reminderRoutes = require("./routes/reminderRoutes");
app.use("/api/reminders", reminderRoutes);

// Tüm rotalardan sonra error handler
app.use(errorHandler);
