const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const CalendarAppointment = require('../models/CalendarAppointment');

// Ortam değişkenine göre doğru .env dosyasını yükle
const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({
  path: path.resolve(__dirname, `../.env.${nodeEnv}`),
});

const connectDB = async () => {
  try {
    if (!process.env.DB_URI) {
      throw new Error('DB_URI is not defined in your .env file.');
    }
    await mongoose.connect(process.env.DB_URI);
    console.log('MongoDB veritabanına başarıyla bağlandı.');
  } catch (error) {
    console.error('MongoDB bağlantı hatası:', error);
    process.exit(1);
  }
};

const migrateAppointments = async () => {
  try {
    await connectDB();

    console.log('Eski saatlik timeIndex formatına sahip randevular aranıyor...');
    
    // Eski saatlik indeksi (0-11) kullanan ve henüz taşınmamış randevuları bulun.
    // `endTimeIndex: { $exists: false }` kontrolü, bu işlemin yalnızca eski kayıtlarda çalışmasını sağlar.
    const oldAppointments = await CalendarAppointment.find({
      timeIndex: { $lte: 11 },
      endTimeIndex: { $exists: false }
    });

    if (oldAppointments.length === 0) {
      console.log('Migrasyon gerektiren randevu bulunamadı.');
      return;
    }

    console.log(`Migrasyon için ${oldAppointments.length} randevu bulundu.`);
    let migratedCount = 0;
    
    for (const appt of oldAppointments) {
      const oldTimeIndex = appt.timeIndex;
      
      // Saatlik indeksi 4 ile çarparak 15 dakikalık indekse dönüştürün.
      // örn., eski indeks 1 (10:00) -> yeni indeks 4 (10:00).
      const newTimeIndex = oldTimeIndex * 4;

      // Yeni indeksin geçerli aralıkta olduğundan emin olun.
      if (newTimeIndex > 47) {
        console.warn(`Randevu ${appt._id} atlanıyor - hesaplanan yeni timeIndex ${newTimeIndex} sınırların dışında.`);
        continue;
      }
      
      // Randevu belgesini güncelle
      appt.timeIndex = newTimeIndex;
      
      // Yeni şema ile belgeyi tutarlı hale getirmek için yeni alanları ayarlayın.
      // Artık 15 dakikalık bir slot olduğu için.
      appt.endTimeIndex = newTimeIndex;
      appt.slotCount = 1;

      await appt.save();
      migratedCount++;
      console.log(`Randevu ${appt._id} taşındı: eski timeIndex ${oldTimeIndex} -> yeni timeIndex ${newTimeIndex}`);
    }

    console.log(`\nMigrasyon betiği tamamlandı. ${oldAppointments.length} randevudan ${migratedCount} tanesi başarıyla güncellendi.`);

  } catch (error) {
    console.error('Migrasyon işlemi sırasında bir hata oluştu:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Veritabanı bağlantısı kapatıldı.');
    }
  }
};

migrateAppointments(); 