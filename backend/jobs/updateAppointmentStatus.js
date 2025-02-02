// jobs/updateAppointmentStatus.js
const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const Payment = require("../models/Payment"); // Ödeme kontrolü için Payment modeliniz var ise

// Her saat başı çalışacak cron job örneği
cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();

    // "Açık" durumdaki, randevu tarihi geçmiş olan randevuları çekiyoruz
    const appointments = await Appointment.find({
      appointmentDateTime: { $lt: now },
      status: "Açık",
    });

    for (const appointment of appointments) {
      // Ödeme kontrolü için (Payment modeli varsa)
      const payment = await Payment.findOne({ appointmentId: appointment._id });
      
      // Eğer ödeme yapılmışsa ve ödenen miktar gereken miktara eşitse
      if (payment && payment.paidAmount >= payment.requiredAmount) {
        appointment.status = "Tamamlandı";
        appointment.actions = { payNow: false, reBook: true, edit: false, view: true };
      } else {
        // Eğer iptal edilmişse (edit sırasında iptal butonuna basılmışsa)
        // Bu güncelleme, randevu iptal edildiğinde farklı bir endpoint veya işlemle yapılmalı.
        // Burada yalnızca randevu tarihi geçtiğinde ödeme yapılmamışsa "Ödeme Bekleniyor" olarak güncelliyoruz.
        appointment.status = "Ödeme Bekleniyor";
        // Varsayılan actions zaten "Açık" durumundaki gibi kalabilir veya gerekirse ayarlanabilir:
        appointment.actions = { payNow: true, reBook: false, edit: true, view: true };
      }
      await appointment.save();
    }
    console.log("Randevu durumları otomatik güncellendi.");
  } catch (err) {
    console.error("Randevu durum güncelleme hatası:", err);
  }
});
