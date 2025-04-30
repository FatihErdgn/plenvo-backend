const cron = require('node-cron');
const moment = require('moment');
const Appointment = require('../models/Appointment');
const CalendarAppointment = require('../models/CalendarAppointment');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const { sendWhatsAppMessage, trackMessageSent } = require('../utils/pullSmsService');

/**
 * Randevu tarihinden 24 saat önce (veya aynı gün) hatırlatma mesajı gönderir
 */
async function sendAppointmentReminders() {
  console.log('Randevu hatırlatma işi başladı:', new Date().toISOString());
  
  try {
    // 1. Normal Appointment modeli için hatırlatmalar
    await processAppointmentReminders();
    
    // 2. CalendarAppointment modeli için hatırlatmalar
    await processCalendarAppointmentReminders();
    
    console.log('Randevu hatırlatma işi tamamlandı:', new Date().toISOString());
  } catch (error) {
    console.error('Hatırlatma işi hatası:', error);
  }
}

/**
 * Appointment modeli için hatırlatma mesajları
 */
async function processAppointmentReminders() {
  // Sadece gelecek 24 saat içindeki ve henüz hatırlatma gönderilmemiş randevuları bul
  const now = moment();
  const tomorrow = moment().add(24, 'hours');
  
  const appointments = await Appointment.find({
    datetime: { $gt: now.toDate(), $lt: tomorrow.toDate() },
    reminderSent: { $ne: true },
    isDeleted: { $ne: true }
  }).populate('customerId').populate('doctorId').populate('clinicId');
  
  console.log(`${appointments.length} adet Appointment hatırlatması bekleniyor`);
  
  for (const appointment of appointments) {
    try {
      // Son bir kez daha appointment'ın gelecekte olduğunu kontrol et
      if (moment(appointment.datetime).isBefore(moment())) {
        console.log(`Appointment ${appointment._id} geçmiş tarihli, hatırlatma gönderilmeyecek`);
        // Geçmiş randevuyu işaretleyelim ki tekrar tekrar sorgulanmasın
        await Appointment.findByIdAndUpdate(appointment._id, { reminderSent: true });
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
  const now = moment();
  const tomorrow = moment().add(24, 'hours');
  
  const calendarAppointments = await CalendarAppointment.find({
    appointmentDate: { $gt: now.toDate(), $lt: tomorrow.toDate() },
    reminderSent: { $ne: true }
  }).populate('customerId').populate('doctorId');
  
  console.log(`${calendarAppointments.length} adet CalendarAppointment hatırlatması bekleniyor`);
  
  for (const appointment of calendarAppointments) {
    try {
      // Son bir kez daha appointment'ın gelecekte olduğunu kontrol et
      if (moment(appointment.appointmentDate).isBefore(moment())) {
        console.log(`CalendarAppointment ${appointment._id} geçmiş tarihli, hatırlatma gönderilmeyecek`);
        // Geçmiş randevuyu işaretleyelim ki tekrar tekrar sorgulanmasın
        await CalendarAppointment.findByIdAndUpdate(appointment._id, { reminderSent: true });
        continue;
      }
      
      await sendReminderForCalendarAppointment(appointment);
    } catch (err) {
      console.error(`CalendarAppointment ${appointment._id} hatırlatma hatası:`, err);
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
  
  // Mesaj içeriğini oluştur
  const dateStr = moment(appointment.datetime).format('DD.MM.YYYY HH:mm');
  const doctorName = appointment.doctorId ? 
    `${appointment.doctorId.firstName} ${appointment.doctorId.lastName}` : 
    'uzmanınız';
  const clinicName = appointment.clinicId?.clinicName || '';
  const customerName = appointment.customerId?.customerName || '';
  
  const message = `Sayın ${appointment.clientFirstName} ${appointment.clientLastName}, 
${dateStr} tarihinde ${doctorName} ile ${customerName} ${clinicName} bölümünde randevunuz bulunmaktadır. 
Randevunuzu hatırlatır, iyi günler dileriz.`;
  
  // WhatsApp üzerinden mesaj gönder
  const result = await sendWhatsAppMessage(
    appointment.customerId.pullSmsApiKey,
    [phoneNumber],
    message
  );
  
  if (result.success) {
    // Başarılı ise, hatırlatma gönderildi olarak işaretle
    await Appointment.findByIdAndUpdate(appointment._id, { 
      reminderSent: true 
    });
    
    // Mesaj sayısını artır
    await trackMessageSent(appointment.customerId._id);
    console.log(`Appointment ${appointment._id} hatırlatması gönderildi`);
  } else {
    console.error(`Appointment ${appointment._id} hatırlatma başarısız:`, result.error);
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
  if (appointment.participantsTelNumbers && appointment.participantsTelNumbers.length > 0) {
    // Boş olmayan ve geçerli numaraları ekle
    phoneNumbers.push(...appointment.participantsTelNumbers.filter(num => num && num.trim()));
  }
  
  if (phoneNumbers.length === 0) {
    console.log(`${appointment._id} için geçerli telefon numarası bulunamadı`);
    return;
  }
  
  // Mesaj içeriğini oluştur
  const dateStr = moment(appointment.appointmentDate).format('DD.MM.YYYY HH:mm');
  const doctorName = appointment.doctorId ? 
    `${appointment.doctorId.firstName} ${appointment.doctorId.lastName}` : 
    'uzmanınız';
  const customerName = appointment.customerId?.customerName || '';
  
  // Katılımcı isimleri
  let participantNames = 'Sayın Hasta';
  if (appointment.participants && appointment.participants.length > 0) {
    participantNames = appointment.participants.map(p => p.name).join(', ');
  }
  
  const message = `Sayın ${participantNames}, 
${dateStr} tarihinde ${doctorName} ile ${customerName} için randevunuz bulunmaktadır. 
Randevunuzu hatırlatır, iyi günler dileriz.`;
  
  // WhatsApp üzerinden mesaj gönder
  const result = await sendWhatsAppMessage(
    appointment.customerId.pullSmsApiKey,
    phoneNumbers,
    message
  );
  
  if (result.success) {
    // Başarılı ise, hatırlatma gönderildi olarak işaretle
    await CalendarAppointment.findByIdAndUpdate(appointment._id, { 
      reminderSent: true 
    });
    
    // Mesaj sayısını telefonların sayısı kadar artır
    for (let i = 0; i < phoneNumbers.length; i++) {
      await trackMessageSent(appointment.customerId._id);
    }
    
    console.log(`CalendarAppointment ${appointment._id} hatırlatması gönderildi (${phoneNumbers.length} numara)`);
  } else {
    console.error(`CalendarAppointment ${appointment._id} hatırlatma başarısız:`, result.error);
  }
}

// Tekrar kontrol ihtiyacını azaltmak için geçmiş randevuları otomatik işaretle
async function markPastAppointments() {
  const now = moment();
  
  // Geçmiş randevuları hatırlatma gönderildi olarak işaretle
  await Appointment.updateMany(
    { 
      datetime: { $lt: now.toDate() }, 
      reminderSent: { $ne: true },
      isDeleted: { $ne: true }
    },
    { 
      reminderSent: true 
    }
  );
  
  await CalendarAppointment.updateMany(
    { 
      appointmentDate: { $lt: now.toDate() }, 
      reminderSent: { $ne: true } 
    },
    { 
      reminderSent: true 
    }
  );
  
  console.log('Geçmiş randevular işaretlendi:', new Date().toISOString());
}

// Ana randevu tarama işlemi öncesinde geçmiş randevuları işaretle 
// Her gün saat 8:45'te çalışır (ana hatırlatma işinden önce)
cron.schedule('45 8 * * *', markPastAppointments);

// Ana hatırlatma işi - Her gün saat 9'da çalışır
cron.schedule('0 9 * * *', sendAppointmentReminders);

module.exports = {
  sendAppointmentReminders,
  markPastAppointments
}; 