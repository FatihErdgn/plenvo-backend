/**
 * Manual trigger script for appointment reminders
 *
 * Usage: node scripts/triggerAppointmentReminders.js
 */
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const {
  sendAppointmentReminders,
  markPastAppointments,
} = require("../jobs/appointmentReminderJob");

// Load environment variables
const nodeEnv = process.env.NODE_ENV || "development";
require("dotenv").config({
  path: path.resolve(__dirname, `../.env.${nodeEnv}`),
});

// Fallback: Try to read .env directly if DB_URI is still undefined
if (!process.env.DB_URI) {
  require("dotenv").config({
    path: path.resolve(__dirname, "../.env"),
  });
}

// Log environment details for debugging
console.log(`Environment: ${nodeEnv}`);
console.log(`DB_URI defined: ${process.env.DB_URI ? "Yes" : "No"}`);

// Use a hard-coded fallback if still not defined
const dbUri = process.env.DB_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/plenvo";

// Connect to MongoDB
mongoose
  .connect(dbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected successfully");
    runJob();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

async function runJob() {
  try {
    console.log("Starting manual appointment reminder job...");

    // Optional: Mark past appointments first
    console.log("Marking past appointments...");
    await markPastAppointments();

    // Run the main reminder job
    console.log("Sending appointment reminders...");
    await sendAppointmentReminders();

    console.log("Manual appointment reminder job completed successfully");

    // Close the MongoDB connection
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error running manual appointment reminder job:", error);
    mongoose.connection.close();
    process.exit(1);
  }
}
