const cron = require('node-cron');
const { sendReminders } = require('../controllers/reminderController');

cron.schedule('*/10 * * * *', async () => {
  console.log('Cron Job: SMS gönderimi başlıyor...');
  await sendReminders();
});
