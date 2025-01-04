const Appointment = require("../models/Appointment");
const sendSMS = require("../utils/smsService");

const sendReminders = async () => {
  try {
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Şu andan 24 saat sonrası

    // Randevuları kontrol et
    const appointments = await Appointment.find({
      date: {
        $gte: twentyFourHoursLater.setMinutes(0, 0, 0), // Saat başını al
        $lte: twentyFourHoursLater.setMinutes(59, 59, 999), // O saatin sonunu al
      },
    }).populate("patient", "name phone");

    // SMS gönder
    for (const appointment of appointments) {
      const message = `Merhaba ${appointment.patient.name}, yarın saat ${appointment.time} için ${appointment.department} randevunuz bulunmaktadır.`;
      await sendSMS(appointment.patient.phone, message);
      // const message = `Merhaba Ümit AKPINAR, yarın saat 14:45 için ODYOLOJİ-Fatih ERDOĞAN randevunuz bulunmaktadır.`;
      // sendSMS('+905456361780', message)
      // sendSMS('+905417900481', message)
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 saniye bekle
    }

    console.log("Tüm hatırlatmalar başarıyla gönderildi.");
  } catch (error) {
    console.error("Hatırlatma gönderim hatası:", error);
  }
};

module.exports = { sendReminders };
