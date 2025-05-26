const cron = require("node-cron");
const moment = require("moment-timezone");
const Appointment = require("../models/Appointment");
const CalendarAppointment = require("../models/CalendarAppointment");
const Customer = require("../models/Customer");
const User = require("../models/User");
const Clinic = require("../models/Clinic");
const Services = require("../models/Services");
const {
  sendWhatsAppMessage,
  trackMessageSent,
} = require("../utils/pullSmsService");

// Instance lock için geçici bir koleksiyon/belge kullanacağız
const mongoose = require("mongoose");
const LockSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  lockedAt: { type: Date, default: Date.now },
  instanceId: String
});
const Lock = mongoose.model("CronLock", LockSchema);

// Her instance için unique bir ID
const instanceId = `${process.pid}-${Date.now()}`;

/**
 * Cron job'u çalıştırmadan önce lock almaya çalış
 */
async function acquireLock(lockName) {
  try {
    // 5 dakikadan eski lock'ları temizle (takılı kalmış olabilir)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await Lock.deleteMany({ 
      name: lockName, 
      lockedAt: { $lt: fiveMinutesAgo } 
    });

    // Yeni lock oluşturmayı dene
    const lock = await Lock.create({ 
      name: lockName, 
      instanceId: instanceId,
      lockedAt: new Date()
    });
    
    return true;
  } catch (error) {
    // Lock zaten varsa false dön
    if (error.code === 11000) { // Duplicate key error
      console.log(`Lock alınamadı: ${lockName} - Başka bir instance çalışıyor`);
      return false;
    }
    console.error("Lock alma hatası:", error);
    return false;
  }
}

/**
 * İşlem bitince lock'u serbest bırak
 */
async function releaseLock(lockName) {
  try {
    await Lock.deleteOne({ name: lockName, instanceId: instanceId });
  } catch (error) {
    console.error("Lock serbest bırakma hatası:", error);
  }
}

/**
 * Randevu tarihinden 24 saat önce (veya aynı gün) hatırlatma mesajı gönderir
 */
async function sendAppointmentReminders() {
  const lockName = "appointment-reminder-job";
  
  // Lock almayı dene
  const hasLock = await acquireLock(lockName);
  if (!hasLock) {
    console.log("Başka bir instance zaten çalışıyor, bu instance atlanıyor.");
    return;
  }

  console.log(`Randevu hatırlatma işi başladı (Instance: ${instanceId}):`, new Date().toISOString());

  try {
    // 1. Normal Appointment modeli için hatırlatmalar
    await processAppointmentReminders();

    // 2. CalendarAppointment modeli için hatırlatmalar
    await processCalendarAppointmentReminders();

    console.log("Randevu hatırlatma işi tamamlandı:", new Date().toISOString());
  } catch (error) {
    console.error("Hatırlatma işi hatası:", error);
  } finally {
    // İşlem bitince lock'u serbest bırak
    await releaseLock(lockName);
  }
}

/**
 * Appointment modeli için hatırlatma mesajları
 */
async function processAppointmentReminders() {
  // Sadece gelecek 24 saat içindeki ve henüz hatırlatma gönderilmemiş randevuları bul
  // UTC zamanı kullan (DB'deki tarihler UTC'de saklanıyor)
  const now = moment().utc();
  const tomorrow = moment().utc().add(24, "hours");

  const appointments = await Appointment.find({
    datetime: { $gt: now.toDate(), $lt: tomorrow.toDate() },
    smsReminderSent: { $ne: true },
    isDeleted: { $ne: true },
  })
    .populate("customerId")
    .populate("doctorId")
    .populate("clinicId")
    .populate("serviceId");

  console.log(
    `${appointments.length} adet Appointment hatırlatması bekleniyor`
  );

  for (const appointment of appointments) {
    try {
      // Son bir kez daha appointment'ın gelecekte olduğunu kontrol et (UTC olarak)
      if (moment(appointment.datetime).utc().isBefore(moment().utc())) {
        console.log(
          `Appointment ${appointment._id} geçmiş tarihli, hatırlatma gönderilmeyecek`
        );
        // Geçmiş randevuyu işaretleyelim ki tekrar tekrar sorgulanmasın
        await Appointment.findByIdAndUpdate(appointment._id, {
          smsReminderSent: true,
        });
        continue;
      }

      // Randevuya ait servis kontrolü
      if (!appointment.serviceId) {
        console.log(`Appointment ${appointment._id} için serviceId bulunamadı`);
        continue;
      }

      // Servis için SMS hatırlatıcı etkin mi?
      let service = appointment.serviceId;
      
      // Eğer populate edilmediyse, servisi manuel olarak bulalım
      if (!service.isSmsReminderActive && !service.serviceName) {
        service = await Services.findById(appointment.serviceId);
      }

      if (!service || !service.isSmsReminderActive) {
        console.log(`Appointment ${appointment._id} için SMS hatırlatıcı etkin değil`);
        // Randevuyu işaretleyelim ki tekrar sorgulanmasın
        await Appointment.findByIdAndUpdate(appointment._id, {
          smsReminderSent: true,
        });
        continue;
      }

      await sendReminderForAppointment(appointment);
    } catch (err) {
      console.error(`Appointment ${appointment._id} hatırlatma hatası:`, err);
    }
  }
}

/**
 * CalendarAppointment modeli için hatırlatma mesajları
 */
async function processCalendarAppointmentReminders() {
  // Sadece gelecek 24 saat içindeki ve henüz hatırlatma gönderilmemiş randevuları bul
  // UTC zamanı kullan (DB'deki tarihler UTC'de saklanıyor)
  const now = moment().utc();
  const tomorrow = moment().utc().add(24, "hours");

  const calendarAppointments = await CalendarAppointment.find({
    appointmentDate: { $gt: now.toDate(), $lt: tomorrow.toDate() },
    smsReminderSent: { $ne: true },
  })
    .populate("customerId")
    .populate("doctorId")
    .populate("serviceId");

  console.log(
    `${calendarAppointments.length} adet CalendarAppointment hatırlatması bekleniyor`
  );

  for (const appointment of calendarAppointments) {
    try {
      // Son bir kez daha appointment'ın gelecekte olduğunu kontrol et (UTC olarak)
      if (moment(appointment.appointmentDate).utc().isBefore(moment().utc())) {
        console.log(
          `CalendarAppointment ${appointment._id} geçmiş tarihli, hatırlatma gönderilmeyecek`
        );
        // Geçmiş randevuyu işaretleyelim ki tekrar tekrar sorgulanmasın
        await CalendarAppointment.findByIdAndUpdate(appointment._id, {
          smsReminderSent: true,
        });
        continue;
      }

      // Randevuya ait servis kontrolü
      if (!appointment.serviceId) {
        console.log(`CalendarAppointment ${appointment._id} için serviceId bulunamadı`);
        continue;
      }

      // Servis için SMS hatırlatıcı etkin mi?
      let service = appointment.serviceId;
      
      // Eğer populate edilmediyse, servisi manuel olarak bulalım
      if (!service.isSmsReminderActive && !service.serviceName) {
        service = await Services.findById(appointment.serviceId);
      }

      if (!service || !service.isSmsReminderActive) {
        console.log(`CalendarAppointment ${appointment._id} için SMS hatırlatıcı etkin değil`);
        // Randevuyu işaretleyelim ki tekrar sorgulanmasın
        await CalendarAppointment.findByIdAndUpdate(appointment._id, {
          smsReminderSent: true,
        });
        continue;
      }

      await sendReminderForCalendarAppointment(appointment);
    } catch (err) {
      console.error(
        `CalendarAppointment ${appointment._id} hatırlatma hatası:`,
        err
      );
    }
  }
}

/**
 * Appointment modeli için hatırlatma mesajı gönderme
 * @param {Object} appointment - Appointment belgesi
 */
async function sendReminderForAppointment(appointment) {
  // Müşteri API anahtarını kontrol et
  if (!appointment.customerId || !appointment.customerId.pullSmsApiKey) {
    console.log(`${appointment._id} için müşteri veya API anahtarı bulunamadı`);
    return;
  }

  // Telefon numarasını al ve formatlama işlemi
  let phoneNumber = appointment.phoneNumber;
  if (!phoneNumber) {
    console.log(`${appointment._id} için telefon numarası bulunamadı`);
    return;
  }

  // Önce atomic olarak smsReminderSent'i true yap ve tekrar kontrol et
  // Bu sayede aynı anda birden fazla process çalışsa bile sadece biri başarılı olur
  const updateResult = await Appointment.findOneAndUpdate(
    {
      _id: appointment._id,
      smsReminderSent: { $ne: true }, // Sadece henüz gönderilmemişse güncelle
      isDeleted: { $ne: true }
    },
    {
      $set: { smsReminderSent: true }
    },
    {
      new: false // Eski değeri döndür
    }
  );

  // Eğer güncelleme başarısızsa (zaten true ise), mesaj gönderme
  if (!updateResult) {
    console.log(`Appointment ${appointment._id} için hatırlatma zaten gönderilmiş`);
    return;
  }

  // Mesaj içeriğini oluştur
  const dateStr = moment(appointment.datetime).tz("Europe/Istanbul").format("DD.MM.YYYY");
  const timeStr = moment(appointment.datetime).tz("Europe/Istanbul").format("HH:mm");
  const doctorName = appointment.doctorId
    ? `${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`
    : "uzmanınız";
  const clinicName = appointment.clinicId?.clinicName || "";
  const customerName = appointment.customerId?.customerName || "";

  const message = `Sayın ${appointment.clientFirstName} ${appointment.clientLastName}, ${dateStr} tarihindeki ${timeStr} saatindeki randevunuzu hatırlatır, sağlıklı ve mutlu günler dileriz.
${customerName} Sağlıklı Yaşam Merkezi`;

  // WhatsApp üzerinden mesaj gönder
  try {
    const result = await sendWhatsAppMessage(
      appointment.customerId.pullSmsApiKey,
      [phoneNumber],
      message
    );

    console.log("PullSMS yanıtı:", result);

    if (result.success || (result.description && result.description.includes('başarılı'))) {
      try {
        await trackMessageSent(appointment.customerId._id);
        console.log(`Appointment ${appointment._id} hatırlatması gönderildi ve bayrak güncellendi.`);
      } catch (dbError) {
        console.error(`Appointment ${appointment._id} İÇİN BAYRAK GÜNCELLEME HATASI (MESAJ GÖNDERİLMİŞ OLABİLİR!):`, dbError);
      }
    } else {
      // Mesaj gönderilemezse flag'i geri al
      await Appointment.findByIdAndUpdate(appointment._id, {
        smsReminderSent: false,
      });
      console.error(
        `Appointment ${appointment._id} hatırlatma API başarısız, flag geri alındı:`,
        result.error || result
      );
    }
  } catch (sendMessageError) {
    // Hata durumunda flag'i geri al
    await Appointment.findByIdAndUpdate(appointment._id, {
      smsReminderSent: false,
    });
    console.error(`Appointment ${appointment._id} MESAJ GÖNDERME API ÇAĞRISI HATASI, flag geri alındı:`, sendMessageError);
  }
}

/**
 * CalendarAppointment modeli için hatırlatma mesajı gönderme
 * @param {Object} appointment - CalendarAppointment belgesi
 */
async function sendReminderForCalendarAppointment(appointment) {
  // Müşteri API anahtarını kontrol et
  if (!appointment.customerId || !appointment.customerId.pullSmsApiKey) {
    console.log(`${appointment._id} için müşteri veya API anahtarı bulunamadı`);
    return;
  }

  // Telefon numaralarını al
  const phoneNumbers = [];

  // Katılımcıların telefon numaralarını topla
  if (
    appointment.participantsTelNumbers &&
    appointment.participantsTelNumbers.length > 0
  ) {
    // Boş olmayan ve geçerli numaraları ekle
    phoneNumbers.push(
      ...appointment.participantsTelNumbers.filter((num) => num && num.trim())
    );
  }

  if (phoneNumbers.length === 0) {
    console.log(`${appointment._id} için geçerli telefon numarası bulunamadı`);
    return;
  }

  // Önce atomic olarak smsReminderSent'i true yap ve tekrar kontrol et
  // Bu sayede aynı anda birden fazla process çalışsa bile sadece biri başarılı olur
  const updateResult = await CalendarAppointment.findOneAndUpdate(
    {
      _id: appointment._id,
      smsReminderSent: { $ne: true } // Sadece henüz gönderilmemişse güncelle
    },
    {
      $set: { smsReminderSent: true }
    },
    {
      new: false // Eski değeri döndür
    }
  );

  // Eğer güncelleme başarısızsa (zaten true ise), mesaj gönderme
  if (!updateResult) {
    console.log(`CalendarAppointment ${appointment._id} için hatırlatma zaten gönderilmiş`);
    return;
  }

  // Mesaj içeriğini oluştur
  const calDateStr = moment(appointment.appointmentDate).tz("Europe/Istanbul").format("DD.MM.YYYY");
  const calTimeStr = moment(appointment.appointmentDate).tz("Europe/Istanbul").format("HH:mm");
  const doctorName = appointment.doctorId
    ? `${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`
    : "uzmanınız";
  const customerName = appointment.customerId?.customerName || "";

  // Katılımcı isimleri
  let participantNames = "Sayın";
  if (appointment.participants && appointment.participants.length > 0) {
    participantNames = appointment.participants.map((p) => p.name).join(", ");
  }

  const message = `Sayın ${participantNames}, ${calDateStr} tarihindeki ${calTimeStr} saatindeki randevunuzu hatırlatır, sağlıklı ve mutlu günler dileriz.
${customerName} Sağlıklı Yaşam Merkezi`;

  // WhatsApp üzerinden mesaj gönder
  try {
    const result = await sendWhatsAppMessage(
      appointment.customerId.pullSmsApiKey,
      phoneNumbers,
      message
    );

    console.log("PullSMS yanıtı:", result);

    // Check for success - either explicit success flag or description indicating success
    if (result.success || (result.description && result.description.includes('başarılı'))) {
      // Mesaj sayısını telefonların sayısı kadar artır
      for (let i = 0; i < phoneNumbers.length; i++) {
        await trackMessageSent(appointment.customerId._id);
      }

      console.log(
        `CalendarAppointment ${appointment._id} hatırlatması gönderildi (${phoneNumbers.length} numara)`
      );
    } else {
      // Mesaj gönderilemezse flag'i geri al
      await CalendarAppointment.findByIdAndUpdate(appointment._id, {
        smsReminderSent: false,
      });
      console.error(
        `CalendarAppointment ${appointment._id} hatırlatma başarısız, flag geri alındı:`,
        result.error || result
      );
    }
  } catch (error) {
    // Hata durumunda flag'i geri al
    await CalendarAppointment.findByIdAndUpdate(appointment._id, {
      smsReminderSent: false,
    });
    console.error(`CalendarAppointment ${appointment._id} mesaj gönderme hatası, flag geri alındı:`, error);
  }
}

// Tekrar kontrol ihtiyacını azaltmak için geçmiş randevuları otomatik işaretle
async function markPastAppointments() {
  const lockName = "mark-past-appointments-job";
  
  // Lock almayı dene
  const hasLock = await acquireLock(lockName);
  if (!hasLock) {
    console.log("Geçmiş randevuları işaretleme: Başka bir instance zaten çalışıyor.");
    return;
  }

  console.log(`Geçmiş randevuları işaretleme başladı (Instance: ${instanceId}):`, new Date().toISOString());
  
  const now = moment().utc();

  try {
    // Geçmiş randevuları hatırlatma gönderildi olarak işaretle
    await Appointment.updateMany(
      {
        datetime: { $lt: now.toDate() },
        smsReminderSent: { $ne: true },
        isDeleted: { $ne: true },
      },
      {
        smsReminderSent: true,
      }
    );

    await CalendarAppointment.updateMany(
      {
        appointmentDate: { $lt: now.toDate() },
        smsReminderSent: { $ne: true },
      },
      {
        smsReminderSent: true,
      }
    );

    console.log("Geçmiş randevular işaretlendi:", new Date().toISOString());
  } catch (error) {
    console.error("Geçmiş randevuları işaretleme hatası:", error);
  } finally {
    // İşlem bitince lock'u serbest bırak
    await releaseLock(lockName);
  }
}

// Ana randevu tarama işlemi öncesinde geçmiş randevuları işaretle
// Her gün saat 14:45'te çalışır (ana hatırlatma işinden önce)
cron.schedule("45 14 * * *", markPastAppointments);

// Ana hatırlatma işi - Her gün saat 15:00'te çalışır
cron.schedule("00 15 * * *", sendAppointmentReminders);

module.exports = {
  sendAppointmentReminders,
  markPastAppointments,
};
