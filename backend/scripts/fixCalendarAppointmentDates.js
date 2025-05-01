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

// Hafta başlangıcını hesapla (Pazartesi)
function getWeekStart(date) {
  // Moment ile pazartesi başlangıçlı hafta başı
  return moment(date).startOf('isoWeek');
}

// DayIndex ve timeIndex'e göre tarihi hesapla
function calculateCorrectDate(originalDate, dayIndex, timeIndex) {
  // Orijinal tarihten hafta başlangıcını bul
  const weekStart = getWeekStart(originalDate);
  
  // dayIndex kadar (0=Pazartesi, 1=Salı...) gün ekle
  const correctDay = moment(weekStart).add(dayIndex, 'days');
  
  // Saat ayarla (TIME_SLOTS: 09:00 dan başlıyor)
  correctDay.hour(9 + Math.floor(timeIndex));
  correctDay.minute(0);
  correctDay.second(0);
  correctDay.millisecond(0);
  
  return correctDay.toDate();
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

    // İlk 5 örnek göster
    console.log("\nDüzeltilecek randevular (ilk 5 örnek):");
    const sampleAppointments = appointmentsToFix.slice(0, 5);
    
    sampleAppointments.forEach((app, index) => {
      const currentDate = moment(app.appointmentDate).format("YYYY-MM-DD HH:mm");
      const correctDate = moment(calculateCorrectDate(app.appointmentDate, app.dayIndex, app.timeIndex)).format("YYYY-MM-DD HH:mm");
      
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