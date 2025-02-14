const Appointment = require("../models/Appointment");
const Customer = require("../models/Customer");
const Clinic = require("../models/Clinic");
const sendSMS = require("../utils/smsService");

const sendReminders = async () => {
  try {
    const now = new Date();
    // 5 dakikalık tolerans penceresi
    const margin = 5 * 60 * 1000; // 5 dakika

    // ──────────────────────────────────────────────
    // 1. Aşama: Immediate SMS gönderimi (randevu oluşturulduğunda)
    const immediateAppointments = await Appointment.find({
      smsImmediateSent: { $ne: true },
      datetime: { $gt: now },
    }).populate("customerId", "isSmsActive smsSenderId smsApiKey");

    for (const appt of immediateAppointments) {
      if (appt.customerId && appt.customerId.isSmsActive) {
        // Müşteri ve klinik bilgilerini alıyoruz (await ile)
        const foundCustomer = await Customer.findOne({ _id: appt.customerId });
        const customerName = foundCustomer ? foundCustomer.customerName : "";
        const foundClinic = await Clinic.findOne({ _id: appt.clinicId });
        const clinicName = foundClinic ? foundClinic.clinicName : "";

        // Telefon numarasını normalize ediyoruz
        let formattedNumber = appt.phoneNumber;
        if (formattedNumber.startsWith("+")) {
          formattedNumber = formattedNumber.substring(1);
        }

        const message = `Sayın ${appt.clientFirstName} ${appt.clientLastName}, ${customerName} merkezinde ${clinicName} bölümündeki randevunuz oluşturulmuştur. Randevu tarihi: ${appt.datetime.toLocaleTimeString()}. Sağlıklı günler dileriz.`;

        await sendSMS(appt.customerId, [formattedNumber], message);

        // Bayrağı güncelle
        appt.smsImmediateSent = true;
        await appt.save();
      }
    }

    // ──────────────────────────────────────────────
    // 2. Aşama: 24 saat öncesi hatırlatma SMS’i
    const lowerBound = new Date(now.getTime() + 24 * 60 * 60 * 1000 - margin);
    const upperBound = new Date(now.getTime() + 24 * 60 * 60 * 1000 + margin);

    const reminderAppointments = await Appointment.find({
      smsReminderSent: { $ne: true },
      datetime: { $gte: lowerBound, $lte: upperBound },
    }).populate("customerId", "isSmsActive smsSenderId smsApiKey createdAt");

    for (const appt of reminderAppointments) {
      if (appt.customerId && appt.customerId.isSmsActive) {
        // Klinik bilgisini de alıyoruz
        const foundClinic = await Clinic.findOne({ _id: appt.clinicId });
        const clinicName = foundClinic ? foundClinic.clinicName : "";

        // Randevu oluşturulma zamanı ile randevu zamanı arasındaki fark kontrolü
        const timeDiff = appt.datetime.getTime() - appt.createdAt.getTime();
        if (timeDiff > 24 * 60 * 60 * 1000) {
          // Telefon numarasını normalize ediyoruz
          let formattedNumber = appt.phoneNumber;
          if (formattedNumber.startsWith("+")) {
            formattedNumber = formattedNumber.substring(1);
          }

          const message = `Sayın ${appt.clientFirstName} ${appt.clientLastName}, yarın ${clinicName} bölümünde ${appt.datetime.toLocaleTimeString()} için randevunuz olduğunu hatırlatır, sağlıklı günler dileriz.`;

          await sendSMS(appt.customerId, [formattedNumber], message);
          appt.smsReminderSent = true;
          await appt.save();
        }
      }
    }

    console.log("Cron Job: Tüm SMS gönderimleri tamamlandı.");
  } catch (error) {
    console.error("Cron Job SMS gönderim hatası:", error);
  }
};

module.exports = { sendReminders };
