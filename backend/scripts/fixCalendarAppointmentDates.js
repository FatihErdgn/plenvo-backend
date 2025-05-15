/**
 * Tek seferlik çalıştırılacak script: CalendarAppointment kayıtlarının tarihlerini
 * dayIndex ve timeIndex değerlerine göre düzeltir
 * 
 * Usage: node scripts/fixCalendarAppointmentDates.js
 */

const mongoose = require("mongoose");
const path = require("path");
const moment = require("moment-timezone");
const readline = require("readline");

// Models
require("../models/CalendarAppointment");
const CalendarAppointment = mongoose.model("CalendarAppointment");

// Türkiye timezone'u
const TIMEZONE = "Europe/Istanbul";

// Environment yükleme
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

// Database connection URI
const dbUri = process.env.DB_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/plenvo";

// DayIndex ve timeIndex'e göre tarihi hesapla
function calculateCorrectDate(originalJsDate, dayIndex, timeIndex) {

  // 1. Adım: Orijinal tarihi (UTC) Istanbul zaman dilimindeki bir moment nesnesine çevir.
  // Bu, hafta başlangıcını ve diğer işlemleri Istanbul zamanına göre doğru yapabilmek için gereklidir.
  const dateInIstanbul = moment(originalJsDate).tz(TIMEZONE);

  // 2. Adım: Istanbul zamanındaki bu tarihin bulunduğu haftanın başlangıcını (Pazartesi 00:00) bul.
  const weekStartInIstanbul = dateInIstanbul.clone().startOf('isoWeek');

  // 3. Adım: Haftanın başlangıcına dayIndex kadar gün ekleyerek doğru günü bul (hala Istanbul zamanında).
  // dayIndex: 0 Pazartesi, 1 Salı, ..., 6 Pazar.
  const correctDayInIstanbul = weekStartInIstanbul.clone().add(dayIndex, 'days');

  // 4. Adım: Saati ayarla. timeIndex=0, Istanbul saatiyle 09:00'a karşılık gelir.
  // Diğer timeIndex değerleri buna göre saatlik artışlarla belirlenir.
  correctDayInIstanbul.hour(9 + Math.floor(timeIndex));
  correctDayInIstanbul.minute(0);
  correctDayInIstanbul.second(0);
  correctDayInIstanbul.millisecond(0);

  // 5. Adım: Elde edilen Istanbul zamanındaki doğru tarih ve saati,
  // JavaScript Date nesnesine (UTC) geri çevir.
  // Örn: timeIndex = 2 ise Istanbul saati 11:00 olur, bu da 08:00 UTC'dir (TIMEZONE UTC+3 ise).
  // Yani UTC saat = timeIndex + 6 olur.
  return correctDayInIstanbul.toDate();
}

// Readline interface oluştur
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// MongoDB'ye bağlan ve düzeltme işlemini başlat
async function main() {
  try {
    // MongoDB bağlantısı
    console.log(`MongoDB bağlantısı kuruluyor: ${dbUri}`);
    await mongoose.connect(dbUri);
    console.log("MongoDB bağlantısı başarılı!");

    // Tüm CalendarAppointment kayıtlarını getir
    const appointments = await CalendarAppointment.find({});
    console.log(`Toplam ${appointments.length} randevu bulundu.`);

    // Düzeltilecek randevuları belirle
    const appointmentsToFix = appointments.filter(app => {
      if (!app.dayIndex && app.dayIndex !== 0) return false;
      if (!app.timeIndex && app.timeIndex !== 0) return false;
      
      // Mevcut tarih
      const currentDate = moment(app.appointmentDate);
      
      // Olması gereken tarih
      const calculatedDate = calculateCorrectDate(app.appointmentDate, app.dayIndex, app.timeIndex);
      const correctDate = moment(calculatedDate);
      
      // Tarihler farklı mı?
      // Saat, dakika ve gün kontrolü yapalım
      return (
        currentDate.hour() !== correctDate.hour() ||
        currentDate.minute() !== correctDate.minute() ||
        currentDate.date() !== correctDate.date()
      );
    });

    console.log(`Düzeltilecek ${appointmentsToFix.length} randevu bulundu.`);

    if (appointmentsToFix.length === 0) {
      console.log("Düzeltilecek randevu yok. İşlem tamamlandı.");
      process.exit(0);
      return;
    }

    // Düzeltilecek randevuları appointmentDate'e göre en yeniden eskiye doğru sırala
    appointmentsToFix.sort((a, b) => moment(b.appointmentDate).valueOf() - moment(a.appointmentDate).valueOf());

    // İlk 5 örnek göster
    console.log("\nDüzeltilecek randevular (en yeni 5 örnek):");
    const sampleAppointments = appointmentsToFix.slice(0, 5);
    
    sampleAppointments.forEach((app, index) => {
      const currentDate = moment.utc(app.appointmentDate).format("YYYY-MM-DD HH:mm [UTC]");
      const correctDate = moment.utc(calculateCorrectDate(app.appointmentDate, app.dayIndex, app.timeIndex)).format("YYYY-MM-DD HH:mm [UTC]");
      
      console.log(`${index + 1}. ID: ${app._id}`);
      console.log(`   Katılımcılar: ${app.participants.map(p => p.name).join(', ')}`);
      console.log(`   Mevcut Tarih: ${currentDate}`);
      console.log(`   Düzeltilecek Tarih: ${correctDate}`);
      console.log(`   DayIndex: ${app.dayIndex}, TimeIndex: ${app.timeIndex}`);
      console.log('---');
    });

    // Kullanıcı onayı
    rl.question("\nBu değişiklikleri uygulamak istiyor musunuz? (evet/hayır): ", async (answer) => {
      if (answer.toLowerCase() === "evet" || answer.toLowerCase() === "e") {
        console.log("Randevular düzeltiliyor...");
        
        let updateCount = 0;
        let errorCount = 0;
        
        // Tüm randevuları düzelt
        for (const app of appointmentsToFix) {
          try {
            const correctedDate = calculateCorrectDate(app.appointmentDate, app.dayIndex, app.timeIndex);
            
            await CalendarAppointment.findByIdAndUpdate(
              app._id,
              { appointmentDate: correctedDate },
              { new: true }
            );
            
            updateCount++;
            if (updateCount % 10 === 0) {
              console.log(`${updateCount}/${appointmentsToFix.length} randevu düzeltildi...`);
            }
          } catch (err) {
            console.error(`Randevu ID: ${app._id} güncellenirken hata:`, err);
            errorCount++;
          }
        }
        
        console.log(`\nİşlem tamamlandı!`);
        console.log(`Düzeltilen randevu sayısı: ${updateCount}`);
        if (errorCount > 0) {
          console.log(`Hata alınan randevu sayısı: ${errorCount}`);
        }
      } else {
        console.log("İşlem iptal edildi.");
      }
      
      mongoose.connection.close();
      rl.close();
    });
  } catch (error) {
    console.error("Hata:", error);
    mongoose.connection.close();
    rl.close();
    process.exit(1);
  }
}

// Script'i başlat
main(); 