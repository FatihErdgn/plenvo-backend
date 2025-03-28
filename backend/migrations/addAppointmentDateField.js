const mongoose = require("mongoose");
const CalendarAppointment = require("../models/CalendarAppointment");
require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

// MongoDB bağlantısı
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("MongoDB bağlantısı başarılı.");
  } catch (error) {
    console.error("MongoDB bağlantısı başarısız:", error);
    process.exit(1);
  }
};

// Bu haftanın başlangıç tarihini hesapla (Pazartesi günü)
const getCurrentWeekStartDate = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Pazar, 1 = Pazartesi, ...
  // Pazartesi gününü bul (day === 0 ise -6, değilse 1-day kadar geri git)
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const migrateAppointmentDates = async () => {
  try {
    await connectDB();

    // Bu haftanın başlangıç tarihi (Pazartesi)
    const weekStartDate = getCurrentWeekStartDate();

    // appointmentDate alanı olmayan tüm randevuları bul
    const appointments = await CalendarAppointment.find({
      appointmentDate: { $exists: false },
    });

    console.log(
      `Toplam ${appointments.length} adet randevuya tarih eklenecek.`
    );

    // Her randevu için dayIndex'e göre tarih oluştur ve güncelle
    for (const appointment of appointments) {
      const appointmentDate = new Date(weekStartDate);
      appointmentDate.setDate(weekStartDate.getDate() + appointment.dayIndex);

      // Saati de ayarla (timeIndex 0 = 09:00, 1 = 10:00, vs.)
      appointmentDate.setHours(9 + Math.floor(appointment.timeIndex), 0, 0, 0);

      // Randevuyu güncelle
      await CalendarAppointment.updateOne(
        { _id: appointment._id },
        { $set: { appointmentDate: appointmentDate } }
      );
    }

    console.log("Migration başarıyla tamamlandı!");
    process.exit(0);
  } catch (error) {
    console.error("Migration hatası:", error);
    process.exit(1);
  }
};

migrateAppointmentDates();
