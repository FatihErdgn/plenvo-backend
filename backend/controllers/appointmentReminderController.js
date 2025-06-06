const moment = require("moment");
const Appointment = require("../models/Appointment");
const CalendarAppointment = require("../models/CalendarAppointment");
const Customer = require("../models/Customer");
const Services = require("../models/Services");
const {
  sendWhatsAppMessage,
  trackMessageSent,
} = require("../utils/pullSmsService");

/**
 * Yeni oluşturulan Appointment türü randevu için WhatsApp mesajı gönderir
 */
async function sendAppointmentImmediateReminder(appointmentId) {
  try {
    // Randevu ve ilgili verileri al
    const appointment = await Appointment.findById(appointmentId)
      .populate("customerId")
      .populate("doctorId")
      .populate("clinicId")
      .populate("serviceId");

    if (!appointment) {
      console.error(`${appointmentId} ID'li randevu bulunamadı`);
      return { success: false, message: "Randevu bulunamadı" };
    }

    // Randevuya ait servis kontrolü
    if (!appointment.serviceId) {
      console.log(`Appointment ${appointmentId} için serviceId bulunamadı`);
      return { success: false, message: "Servis bilgisi bulunamadı" };
    }

    // Servis için SMS hatırlatıcı etkin mi?
    let service = appointment.serviceId;
    
    // Eğer populate edilmediyse, servisi manuel olarak bulalım
    if (!service.isSmsReminderActive && !service.serviceName) {
      service = await Services.findById(appointment.serviceId);
    }

    if (!service || !service.isSmsReminderActive) {
      console.log(`Appointment ${appointmentId} için SMS hatırlatıcı etkin değil`);
      return { success: false, message: "Bu hizmet için SMS hatırlatıcı etkin değil" };
    }

    // Müşteri bilgilerini ve API anahtarını kontrol et
    if (!appointment.customerId || !appointment.customerId.pullSmsApiKey) {
      console.error(
        `${appointmentId} için müşteri bilgisi veya API anahtarı bulunamadı`
      );
      return { success: false, message: "Müşteri API anahtarı bulunamadı" };
    }

    // Telefon numarası kontrolü
    if (!appointment.phoneNumber) {
      console.error(`${appointmentId} için telefon numarası bulunamadı`);
      return { success: false, message: "Telefon numarası bulunamadı" };
    }

    // Mesaj içeriğini oluştur
    const dateStr = moment(appointment.datetime).tz("Europe/Istanbul").format("DD.MM.YYYY");
    const timeStr = moment(appointment.datetime).tz("Europe/Istanbul").format("HH:mm");
    const doctorName = appointment.doctorId
      ? `${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`
      : "uzmanınız";
    const clinicName = appointment.clinicId?.clinicName || "";
    const customerName = appointment.customerId?.customerName || "";

    const message = `Sayın ${appointment.clientFirstName} ${appointment.clientLastName}, ${dateStr} tarihindeki ${timeStr} saatindeki randevunuz oluşturulmuştur. Sağlıklı ve mutlu günler dileriz.
${customerName} Sağlıklı Yaşam Merkezi`;

    // WhatsApp üzerinden mesaj gönder
    const result = await sendWhatsAppMessage(
      appointment.customerId.pullSmsApiKey,
      [appointment.phoneNumber],
      message
    );

    console.log(result);

    if (result.success) {
      // Başarılı ise, hatırlatma gönderildi olarak işaretle
      await Appointment.findByIdAndUpdate(appointmentId, {
        smsImmediateSent: true,
      });

      // Mesaj sayısını artır
      await trackMessageSent(appointment.customerId._id);

      console.log(
        `Appointment ${appointmentId} anında hatırlatması gönderildi`
      );
      return { success: true, message: "Hatırlatma mesajı gönderildi" };
    } else {
      console.error(
        `Appointment ${appointmentId} anında hatırlatma başarısız:`,
        result.error
      );
      return {
        success: false,
        message: "Hatırlatma mesajı gönderilemedi",
        error: result.error,
      };
    }
  } catch (error) {
    console.error(
      `Appointment ${appointmentId} anında hatırlatma hatası:`,
      error
    );
    return {
      success: false,
      message: "Hatırlatma işleminde hata",
      error: error.message,
    };
  }
}

/**
 * Yeni oluşturulan CalendarAppointment türü randevu için WhatsApp mesajı gönderir
 */
async function sendCalendarAppointmentImmediateReminder(appointmentId) {
  try {
    // Randevu ve ilgili verileri al
    const appointment = await CalendarAppointment.findById(appointmentId)
      .populate("customerId")
      .populate("doctorId")
      .populate("serviceId");

    if (!appointment) {
      console.error(`${appointmentId} ID'li takvim randevusu bulunamadı`);
      return { success: false, message: "Randevu bulunamadı" };
    }

    // Randevuya ait servis kontrolü
    if (!appointment.serviceId) {
      console.log(`CalendarAppointment ${appointmentId} için serviceId bulunamadı`);
      return { success: false, message: "Servis bilgisi bulunamadı" };
    }

    // Servis için SMS hatırlatıcı etkin mi?
    let service = appointment.serviceId;
    
    // Eğer populate edilmediyse, servisi manuel olarak bulalım
    if (!service.isSmsReminderActive && !service.serviceName) {
      service = await Services.findById(appointment.serviceId);
    }

    if (!service || !service.isSmsReminderActive) {
      console.log(`CalendarAppointment ${appointmentId} için SMS hatırlatıcı etkin değil`);
      return { success: false, message: "Bu hizmet için SMS hatırlatıcı etkin değil" };
    }

    // Müşteri bilgilerini ve API anahtarını kontrol et
    if (!appointment.customerId || !appointment.customerId.pullSmsApiKey) {
      console.error(
        `${appointmentId} için müşteri bilgisi veya API anahtarı bulunamadı`
      );
      return { success: false, message: "Müşteri API anahtarı bulunamadı" };
    }

    // Telefon numaralarını al
    const phoneNumbers = [];

    // Katılımcıların telefon numaralarını topla
    if (
      appointment.participantsTelNumbers &&
      appointment.participantsTelNumbers.length > 0
    ) {
      phoneNumbers.push(
        ...appointment.participantsTelNumbers.filter((num) => num && num.trim())
      );
    }

    if (phoneNumbers.length === 0) {
      console.error(
        `${appointmentId} için geçerli telefon numarası bulunamadı`
      );
      return { success: false, message: "Geçerli telefon numarası bulunamadı" };
    }

    // Mesaj içeriğini oluştur
    const dateStr = moment(appointment.appointmentDate).tz("Europe/Istanbul").format("DD.MM.YYYY");
    const timeStr = moment(appointment.appointmentDate).tz("Europe/Istanbul").format("HH:mm");
    const doctorName = appointment.doctorId
      ? `${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`
      : "uzmanınız";
    const customerName = appointment.customerId?.customerName || "";

    // Katılımcı isimleri
    let participantNames = "Sayın";
    if (appointment.participants && appointment.participants.length > 0) {
      participantNames = appointment.participants.map((p) => p.name).join(", ");
    }

    const message = `Sayın ${participantNames}, ${dateStr} tarihindeki ${timeStr} saatindeki randevunuz oluşturulmuştur. Sağlıklı ve mutlu günler dileriz.
${customerName} Sağlıklı Yaşam Merkezi`;

    // WhatsApp üzerinden mesaj gönder
    const result = await sendWhatsAppMessage(
      appointment.customerId.pullSmsApiKey,
      phoneNumbers,
      message
    );

    if (result.success) {
      // Başarılı ise, hatırlatma gönderildi olarak işaretle
      await CalendarAppointment.findByIdAndUpdate(appointmentId, {
        smsImmediateSent: true,
      });

      // Mesaj sayısını telefonların sayısı kadar artır
      for (let i = 0; i < phoneNumbers.length; i++) {
        await trackMessageSent(appointment.customerId._id);
      }

      console.log(
        `CalendarAppointment ${appointmentId} anında hatırlatması gönderildi (${phoneNumbers.length} numara)`
      );
      return { success: true, message: "Hatırlatma mesajı gönderildi" };
    } else {
      console.error(
        `CalendarAppointment ${appointmentId} anında hatırlatma başarısız:`,
        result.error
      );
      return {
        success: false,
        message: "Hatırlatma mesajı gönderilemedi",
        error: result.error,
      };
    }
  } catch (error) {
    console.error(
      `CalendarAppointment ${appointmentId} anında hatırlatma hatası:`,
      error
    );
    return {
      success: false,
      message: "Hatırlatma işleminde hata",
      error: error.message,
    };
  }
}

module.exports = {
  sendAppointmentImmediateReminder,
  sendCalendarAppointmentImmediateReminder,
};
