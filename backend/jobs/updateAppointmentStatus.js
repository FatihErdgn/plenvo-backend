// jobs/updateAppointmentStatus.js

const cron = require("node-cron");
const { updateAppointmentStatuses } = require("../controllers/appointmentController");

// Her saat başı çalışacak cron job (0 dakika her saat)
cron.schedule("0 * * * *", async () => {
  console.log("Cron Job: Randevu status güncellemeleri kontrol ediliyor...");
  await updateAppointmentStatuses();
});
