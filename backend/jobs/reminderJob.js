const cron = require('node-cron');
const { sendReminders } = require('../controllers/reminderController');

// Her gün gece 12'de çalışacak cron job
cron.schedule('0 0 * * *', async () => {
    console.log('Hatırlatma gönderimi başlıyor...');
    await sendReminders();
});
