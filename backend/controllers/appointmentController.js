// controllers/appointmentController.js

const Appointment = require("../models/Appointment");
const User = require("../models/User");
const Clinic = require("../models/Clinic");
const Payment = require("../models/Payment");
const generateUniqueAppointmentCode = require("../utils/uniqueAppointmentCode");

// createAppointment: Randevu oluşturma
exports.createAppointment = async (req, res) => {
  try {
    const {
      clientFirstName,
      clientLastName,
      phoneNumber,
      datetime,
      gender,
      age,
      clinic,
      doctor,
      type,
      participants,
      statusComment,
    } = req.body;

    // Randevu tipi kontrolü
    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Randevu tipi belirtilmelidir.",
      });
    }

    // Grup randevusu için gerekli alanlar
    if (type === "group") {
      if (
        !clinic ||
        !doctor ||
        !datetime ||
        !participants ||
        !Array.isArray(participants) ||
        participants.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Grup randevularında klinik, doktor, tarih ve en az bir katılımcı bilgisi doldurulmalıdır.",
        });
      }
      // İsteğe bağlı: Her katılımcı için gerekli alanları kontrol edebilirsiniz.
      for (const participant of participants) {
        if (
          !participant.clientFirstName ||
          !participant.clientLastName ||
          !participant.phoneNumber ||
          !participant.gender
          // !participant.age
        ) {
          return res.status(400).json({
            success: false,
            message: "Her katılımcı için tüm alanlar doldurulmalıdır.",
          });
        }
      }
    }
    // Tek kişilik randevu için gerekli alanlar
    else if (type === "single") {
      if (
        !clientFirstName ||
        !clientLastName ||
        !phoneNumber ||
        !datetime ||
        !gender ||
        // !age ||
        !clinic ||
        !doctor
      ) {
        return res.status(400).json({
          success: false,
          message: "Tek kişilik randevularda tüm alanlar doldurulmalıdır.",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Geçersiz randevu tipi.",
      });
    }

    // Randevu tarihini parse et (örneğin "13-Aug-2023 10:00:00")
    const apptDate = new Date(datetime);
    if (isNaN(apptDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz randevu tarihi.",
      });
    }

    // Varsayılan actions ve status belirle
    let actions = {
      payNow: true,
      reBook: false,
      edit: true,
      view: true,
    };
    let status = "Açık";
    // Eğer randevu tarihi geçmişse, status başlangıçta "Ödeme Bekleniyor" olabilir.
    if (apptDate < new Date()) {
      status = "Ödeme Bekleniyor";
    }

    // Token'dan customerId ve clinicId alınır (authentication middleware req.user'ı doldurmalı)
    const customerId = req.user.customerId;

    // paymentId başlangıçta null
    const paymentId = null;

    const foundClinic = await Clinic.findOne({ clinicName: clinic });
    if (!foundClinic) {
      return res.status(404).json({
        success: false,
        message: "Belirtilen klinik bulunamadı.",
      });
    }

    // Doktor bilgisi: Frontend'den gelen doktor adını kullanarak User modelinde arama yap
    let doctorName = doctor;
    if (doctorName.startsWith("Dr. ")) {
      doctorName = doctorName.substring(4);
    }
    // Doktor adı beklenen format: "FirstName LastName"
    const nameParts = doctorName.split(" ");
    if (nameParts.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz doktor adı.",
      });
    }
    const doctorFirstName = nameParts[0];
    const doctorLastName = nameParts.slice(1).join(" ");
    const doctorUser = await User.findOne({
      firstName: doctorFirstName,
      lastName: doctorLastName,
    });
    if (!doctorUser) {
      return res.status(404).json({
        success: false,
        message: "Belirtilen doktor bulunamadı.",
      });
    }
    const doctorId = doctorUser._id;

    // uniqueCode üretimi
    const uniqueCode = generateUniqueAppointmentCode();

    // Yeni Appointment belgesini oluştur
    const newAppointment = new Appointment({
      customerId,
      clinicId: foundClinic._id,
      paymentId,
      doctorId,
      type,
      clientFirstName,
      clientLastName,
      phoneNumber,
      datetime: apptDate,
      status,
      statusComment,
      actions,
      gender,
      age,
      uniqueCode,
      // Eğer grup randevusuysa, varsa katılımcıları ekle
      participants: type === "group" && participants ? participants : [],
    });

    const savedAppointment = await newAppointment.save();
    return res.status(201).json({
      success: true,
      appointment: savedAppointment,
    });
  } catch (err) {
    console.error("Create Appointment Error:", err);
    return res.status(500).json({
      success: false,
      message: "Randevu oluşturulurken bir hata oluştu.",
    });
  }
};

// getAppointments: Sayfalama ve sıralı randevu listesi getirme
// getAppointments: Sayfalama ve sıralı randevu listesi getirme
exports.getAppointments = async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const userId = req.user.userId;
    const userRole = req.user.role;

    let query = { isDeleted: false };

    if (userRole === "doctor") {
      // Eğer kullanıcı doktor ise, sadece kendi randevularını görsün
      query.doctorId = userId;
    } else if (customerId) {
      // Eğer kullanıcı müşteriyle ilişkili bir rolse, customerId baz alınsın
      query.customerId = customerId;
    }

    const appointments = await Appointment.find(query)
      .populate("clinicId", "clinicName")
      .populate("doctorId", "firstName lastName")
      .sort({ datetime: -1 }) // Son eklenen en üstte
      .lean();

    const transformedAppointments = appointments.map((appointment) => ({
      ...appointment,
      clinicName: appointment.clinicId?.clinicName,
      doctorName: `${appointment.doctorId?.firstName || ""} ${
        appointment.doctorId?.lastName || ""
      }`,
    }));

    return res.status(200).json({
      success: true,
      data: transformedAppointments,
    });
  } catch (err) {
    console.error("Get Appointments Error:", err);
    return res.status(500).json({
      success: false,
      message: "Randevular alınırken bir hata oluştu.",
    });
  }
};

/**
 * Randevu Güncelleme (Edit)
 * Frontend'den gelen güncellenmiş alanlarla randevuyu düzenler.
 * - Güncellenen alanlar: clientFirstName, clientLastName, phoneNumber, datetime, gender, age, clinic, doctor, type, participants, status vb.
 * - Eğer status "İptal Edildi" veya "Tamamlandı" ise actions güncellenir.
 * - Güncellemede, lastEditBy ve lastEditDate token'dan gelen kullanıcıyla ayarlanır.
 */
exports.updateAppointment = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "admin" && role !== "consultant" && role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Bu işlemi yapmaya yetkiniz yok.",
      });
    }
    const appointmentId = req.params.id;
    const updateData = { ...req.body };

    // Zorunlu alanlarda validasyon yapabilirsiniz
    if (updateData.datetime) {
      const newDate = new Date(updateData.datetime);
      if (isNaN(newDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Geçersiz tarih formatı." });
      }
      updateData.datetime = newDate;
    }

    // lastEditBy ve lastEditDate ayarlanıyor (req.user, authentication middleware tarafından doldurulmalı)
    updateData.lastEditBy = req.user._id;
    updateData.lastEditDate = new Date();

    // Eğer status "İptal Edildi" veya "Tamamlandı" ise actions sabitlenir
    if (["İptal Edildi", "Tamamlandı"].includes(updateData.status)) {
      updateData.actions = {
        payNow: false,
        reBook: true,
        edit: false,
        view: true,
      };
    } else if (!updateData.actions) {
      // Diğer durumlarda varsayılan actions
      updateData.actions = {
        payNow: true,
        reBook: false,
        edit: true,
        view: true,
      };
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      updateData,
      { new: true }
    );

    if (!updatedAppointment) {
      return res
        .status(404)
        .json({ success: false, message: "Randevu bulunamadı." });
    }

    return res
      .status(200)
      .json({ success: true, appointment: updatedAppointment });
  } catch (err) {
    console.error("Update Appointment Error:", err);
    return res.status(500).json({
      success: false,
      message: "Randevu güncellenirken bir hata oluştu.",
    });
  }
};

/**
 * Randevuyu Soft Delete Yap (isDeleted = true)
 */
exports.softDeleteAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        isDeleted: true,
        lastEditBy: req.user._id,
        lastEditDate: new Date(),
      },
      { new: true }
    );

    if (!updatedAppointment) {
      return res
        .status(404)
        .json({ success: false, message: "Randevu bulunamadı." });
    }

    return res
      .status(200)
      .json({ success: true, appointment: updatedAppointment });
  } catch (err) {
    console.error("Soft Delete Appointment Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Randevu silinirken bir hata oluştu." });
  }
};

/**
 * Cron Job Fonksiyonu: Randevu tarihine göre otomatik status güncellemesi.
 * - Eğer randevu tarihi geçmiş ve hala "Açık" ise, ödeme yapılmadıysa "Ödeme Bekleniyor" olarak güncellenir.
 * - Eğer ilgili ödeme varsa ve ödeme tamamlanmışsa "Tamamlandı" olarak ayarlanır.
 */
exports.updateAppointmentStatuses = async () => {
  try {
    const now = new Date();

    // "Açık" durumda olan, randevu tarihi geçmiş ve silinmemiş randevuları tek sorguyla al
    const appointmentsToUpdate = await Appointment.find({
      status: "Açık",
      datetime: { $lt: now },
      isDeleted: false,
    });

    if (appointmentsToUpdate.length === 0) {
      console.log("Cron Job: Güncellenecek randevu bulunamadı.");
      return;
    }

    // Tüm güncellenmesi gereken randevu ID'lerini al
    const appointmentIds = appointmentsToUpdate.map((a) => a._id);

    // Bu randevulara bağlı **tüm ödemeleri tek sorguyla** al
    const payments = await Payment.find({
      appointmentId: { $in: appointmentIds },
      isDeleted: false,
    });

    // Ödemeleri daha hızlı erişebilmek için bir Map oluştur
    const paymentMap = new Map();
    payments.forEach((payment) => {
      paymentMap.set(payment.appointmentId.toString(), payment.paymentStatus);
    });

    // Güncellenmesi gereken randevular için toplu update işlemi oluştur
    const bulkUpdates = appointmentsToUpdate.map((appointment) => {
      const paymentStatus = paymentMap.get(appointment._id.toString());
      const newStatus =
        paymentStatus === "Tamamlandı" ? "Tamamlandı" : "Ödeme Bekleniyor";
      const newActions =
        newStatus === "Tamamlandı"
          ? { payNow: false, reBook: true, edit: false, view: true }
          : { payNow: true, reBook: false, edit: true, view: true };

      return {
        updateOne: {
          filter: { _id: appointment._id },
          update: {
            status: newStatus,
            actions: newActions,
            lastEditDate: now,
          },
        },
      };
    });

    // **Tek bir updateMany işlemiyle tüm güncellemeleri yap**
    if (bulkUpdates.length > 0) {
      await Appointment.bulkWrite(bulkUpdates);
      console.log(`Cron Job: ${bulkUpdates.length} randevu güncellendi.`);
    }
  } catch (err) {
    console.error("Cron Job Error:", err);
  }
};
