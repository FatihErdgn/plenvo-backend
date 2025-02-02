// controllers/appointmentController.js
const Appointment = require("../models/Appointment");
const generateUniqueAppointmentCode = require("../utils/uniqueAppointmentCode");

exports.createAppointment = async (req, res) => {
    try {
      // Front-end'den gelen alanları destructure ediyoruz:
      const {
        firstName,
        lastName,
        phoneNumber,
        appointmentDateTime,
        gender,
        age,
        clinic,
        doctor,
        type,
        participants, // Eğer group randevusuyse
      } = req.body;
  
      // Authentication middleware'nin eklediği bilgiler
      const customerId = req.user.customerId;
      const clinicId = req.user.clinicId;
  
      // Varsayılan actions ve status
      const defaultActions = {
        payNow: true,
        reBook: false,
        edit: true,
        view: true,
      };
  
      // Yeni Appointment nesnesi oluşturuyoruz:
      const newAppointment = new Appointment({
        customerId,
        clinicId,
        type, // "single" veya "group"
        firstName,
        lastName,
        phoneNumber,
        appointmentDateTime: new Date(appointmentDateTime), // String'den Date'e dönüştürme
        status: "Açık", // İlk oluşturulma durumu
        actions: defaultActions,
        gender,
        age,
        clinic,   // Örneğin "Dermatology"
        doctor,
        uniqueCode: generateUniqueAppointmentCode(),
      });
  
      // Eğer randevu "group" tipindeyse ve participants gönderildiyse:
      if (type === "group" && participants) {
        newAppointment.participants = participants;
      }
  
      await newAppointment.save();
      return res.status(201).json({ success: true, appointment: newAppointment });
    } catch (error) {
      console.error("Appointment oluşturma hatası:", error);
      return res.status(500).json({ success: false, message: "Randevu oluşturulamadı", error: error.message });
    }
  };
  

// controllers/appointmentController.js
const Appointment = require("../models/Appointment");

exports.updateAppointment = async (req, res) => {
  try {
    // URL parametresinden randevu id'si alınıyor
    const appointmentId = req.params.id;
    // Front-end'den gelen güncelleme verileri
    const {
      firstName,
      lastName,
      phoneNumber,
      appointmentDateTime,
      gender,
      age,
      clinic,
      doctor,
      type,
      participants,
      status, // Güncellenmek istenen yeni durum (opsiyonel)
    } = req.body;
    
    // Authentication middleware'nin eklediği kullanıcı bilgisi (örneğin req.user)
    const currentUserId = req.user._id;

    // Silinmemiş (isDeleted: false) ve var olan randevuyu bul
    const appointment = await Appointment.findOne({ _id: appointmentId, isDeleted: false });
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Randevu bulunamadı" });
    }

    // Front-end'den gelen alanlarla güncelleme yapıyoruz
    if (firstName !== undefined) appointment.firstName = firstName;
    if (lastName !== undefined) appointment.lastName = lastName;
    if (phoneNumber !== undefined) appointment.phoneNumber = phoneNumber;
    if (appointmentDateTime !== undefined) {
      appointment.appointmentDateTime = new Date(appointmentDateTime);
    }
    if (gender !== undefined) appointment.gender = gender;
    if (age !== undefined) appointment.age = age;
    if (clinic !== undefined) appointment.clinic = clinic;
    if (doctor !== undefined) appointment.doctor = doctor;
    if (type !== undefined) appointment.type = type;
    if (type === "group" && participants !== undefined) {
      // Eğer randevu tipi group ise, katılımcılar da güncellenir
      appointment.participants = participants;
    }

    // Status güncellemesi varsa, status ve actions alanlarını kurala göre ayarlıyoruz.
    if (status !== undefined) {
      appointment.status = status;
      if (status === "İptal Edildi" || status === "Tamamlandı") {
        appointment.actions = { payNow: false, reBook: true, edit: false, view: true };
      } else {
        appointment.actions = { payNow: true, reBook: false, edit: true, view: true };
      }
    }

    // Güncelleyen kullanıcı bilgisi ve güncelleme tarihi
    appointment.lastEditBy = currentUserId;
    appointment.lastEditDate = new Date();

    await appointment.save();

    return res.status(200).json({ success: true, appointment });
  } catch (error) {
    console.error("Randevu güncelleme hatası:", error);
    return res.status(500).json({
      success: false,
      message: "Randevu güncellenemedi",
      error: error.message,
    });
  }
};
// controllers/appointmentController.js
exports.deleteAppointment = async (req, res) => {
    try {
      const appointmentId = req.params.id;
      const currentUserId = req.user._id;
  
      // Silinmemiş randevuyu buluyoruz
      const appointment = await Appointment.findOne({ _id: appointmentId, isDeleted: false });
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Randevu bulunamadı" });
      }
  
      // Soft delete: isDeleted alanını true yapıyoruz
      appointment.isDeleted = true;
      appointment.lastEditBy = currentUserId;
      appointment.lastEditDate = new Date();
  
      await appointment.save();
  
      return res.status(200).json({ success: true, message: "Randevu başarıyla silindi" });
    } catch (error) {
      console.error("Randevu silme hatası:", error);
      return res.status(500).json({
        success: false,
        message: "Randevu silinemedi",
        error: error.message,
      });
    }
  };
  