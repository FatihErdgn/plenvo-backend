// jobs/updateAppointmentStatus.js

const cron = require("node-cron");
const { updateAppointmentStatuses } = require("../controllers/appointmentController");

// Her yarım saatte bir çalışacak cron job
cron.schedule("0,30 * * * *", async () => {
  console.log("Cron Job: Randevu status güncellemeleri kontrol ediliyor...");
  await updateAppointmentStatuses();
});
