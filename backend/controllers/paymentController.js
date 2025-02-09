// controllers/paymentController.js

const Payment = require("../models/Payment");
const Appointment = require("../models/Appointment");
const Currency = require("../models/Currency");
const Services = require("../models/Services");
const mongoose = require("mongoose");

/**
 * createPayment: Bir randevu için ödeme oluşturur.
 * İstenen alanlar:
 *  - currencyId (frontend’den gönderilen para birimi ID’si)
 *  - serviceIds: Seçilen hizmetlerin ID’leri (array)
 *  - paymentMethod, paymentAmount, paymentDescription
 *  - appointmentId: Hangi randevu için ödeme yapılıyor
 *
 * Token'dan alınan customerId, randevudan alınan doctorId (userId) kullanılır.
 * Seçilen hizmetlerin toplam ücreti (serviceFee) ve hizmet adları hesaplanır.
 *
 * Ek olarak: Ödeme kaydı oluşturulduktan sonra,
 * - Ödenen miktar toplam hizmet ücretine eşit ya da fazlaysa randevunun durumu "Tamamlandı"
 *   ve ilgili action'lar güncellenecektir.
 * - Ödenen miktar toplam ücretin altında ise randevu durumu "Ödeme Bekleniyor" olarak güncellenecektir.
 */
exports.createPayment = async (req, res) => {
  try {
    const {
      currencyName,
      serviceIds, // array
      paymentMethod,
      paymentAmount,
      paymentDescription,
      appointmentId,
      paymentDate, // opsiyonel
    } = req.body;

    // Gerekli alan kontrolü
    if (
      !currencyName ||
      !serviceIds ||
      !paymentMethod ||
      !paymentAmount ||
      // !paymentDescription ||
      !appointmentId
    ) {
      return res.status(400).json({
        success: false,
        message: "Gerekli tüm ödeme alanları doldurulmalıdır.",
      });
    }

    // customerId token üzerinden
    const customerId = req.user.customerId;
    if (!customerId) {
      return res
        .status(401)
        .json({ success: false, message: "Müşteri kimliği bulunamadı." });
    }

    // Randevuyu getirerek doctorId (userId) al
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Randevu bulunamadı." });
    }
    const userId = appointment.doctorId;

    // Seçilen hizmetlerin (serviceIds) detaylarını getir
    const services = await Services.find({
      _id: { $in: serviceIds.map((id) => new mongoose.Types.ObjectId(id)) },
      isDeleted: false,
      status: "Aktif",
    });

    if (services.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Seçilen hizmetler bulunamadı veya aktif değil.",
      });
    }
    const totalServiceFee = services.reduce(
      (sum, svc) => sum + svc.serviceFee,
      0
    );
    const serviceDescriptions = services.map((svc) => svc.serviceName);

    // Ödeme tarihi: verilmediyse şimdiki tarih
    const paymentDateFinal = paymentDate ? new Date(paymentDate) : new Date();

    const foundCurrency = await Currency.findOne({ currencyName });
    if (!foundCurrency) {
      return res
        .status(400)
        .json({ success: false, message: "Para birimi bulunamadı." });
    }

    // Ödeme şeması oluşturuluyor.
    // Burada ödeme durumu; ödenen tutarın toplam hizmet ücretine eşit veya fazlaysa "Tamamlandı",
    // aksi durumda "Ödeme Bekleniyor" olarak ayarlanıyor.
    const newPayment = new Payment({
      customerId,
      currencyId: foundCurrency._id,
      userId,
      serviceId: serviceIds, // Şema array tipindeyse bu şekilde, aksi halde uygun dönüşüm yapılmalı.
      appointmentId,
      paymentMethod,
      paymentAmount,
      paymentDate: paymentDateFinal,
      paymentStatus:
        paymentAmount >= totalServiceFee ? "Tamamlandı" : "Ödeme Bekleniyor",
      paymentDescription,
      serviceFee: totalServiceFee, // Toplam hizmet ücreti
      serviceDescription: serviceDescriptions.join(", "),
      isDeleted: false,
    });

    const savedPayment = await newPayment.save();

    // Ödeme oluşturulduktan sonra ilgili randevunun status'unu güncelle
    // Eğer ödenen tutar toplam hizmet ücretine eşit veya fazlaysa "Tamamlandı",
    // aksi halde "Ödeme Bekleniyor" olarak ayarlıyoruz.
    if (paymentAmount >= totalServiceFee) {
      appointment.status = "Tamamlandı";
      appointment.actions = {
        payNow: false,
        reBook: true,
        edit: false,
        view: true,
      };
    } else {
      appointment.status = "Ödeme Bekleniyor";
      appointment.actions = {
        payNow: true,
        reBook: false,
        edit: true,
        view: true,
      };
    }
    await appointment.save();

    return res.status(201).json({ success: true, payment: savedPayment });
  } catch (err) {
    console.error("Create Payment Error:", err);
    return res.status(500).json({
      success: false,
      message: "Ödeme oluşturulurken bir hata oluştu.",
    });
  }
};

/**
 * updatePayment: Mevcut ödemeyi günceller.
 * Örneğin kısmi ödeme yapıldığında ya da ödeme tamamlandığında, ödeme güncellenir.
 *
 * Ek olarak: Ödeme güncellendikten sonra, ilgili randevunun status'u
 * - Ödeme tutarı toplam hizmet ücretine eşit veya fazlaysa "Tamamlandı",
 * - Aksi halde "Ödeme Bekleniyor" olarak güncellenecektir.
 */
exports.updatePayment = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const updateData = req.body;

    // İlgili ödeme kaydı güncelleniyor.
    const updatedPayment = await Payment.findByIdAndUpdate(
      paymentId,
      updateData,
      {
        new: true,
      }
    );
    if (!updatedPayment) {
      return res
        .status(404)
        .json({ success: false, message: "Ödeme bulunamadı." });
    }

    // Ödeme güncellendikten sonra, randevu durumunu güncellemek için ilgili randevuyu getiriyoruz.
    // İlgili randevuyu getir
    const appointmentId = updatedPayment.appointmentId;
    const appointment = await Appointment.findById(appointmentId);
    if (appointment) {
      // Toplam ödeme miktarını hesapla
      const paymentsAgg = await Payment.aggregate([
        { $match: { appointmentId: appointmentId, isDeleted: false } },
        { $group: { _id: null, totalPaid: { $sum: "$paymentAmount" } } },
      ]);
      const cumulativePaid = paymentsAgg[0]?.totalPaid || 0;
      const totalServiceFee = updatedPayment.serviceFee;

      if (cumulativePaid >= totalServiceFee) {
        appointment.status = "Tamamlandı";
        appointment.actions = {
          payNow: false,
          reBook: true,
          edit: false,
          view: true,
        };
      } else {
        appointment.status = "Ödeme Bekleniyor";
        appointment.actions = {
          payNow: true,
          reBook: false,
          edit: true,
          view: true,
        };
      }
      await appointment.save();
    }

    return res.status(200).json({ success: true, payment: updatedPayment });
  } catch (err) {
    console.error("Update Payment Error:", err);
    return res.status(500).json({
      success: false,
      message: "Ödeme güncellenirken bir hata oluştu.",
    });
  }
};

/**
 * getPaymentsByAppointment: Belirtilen randevu ID'sine ait tüm aktif (isDeleted=false) ödeme kayıtlarını getirir.
 * Route örneği: GET /api/payments/appointment/:appointmentId
 */
exports.getPaymentsByAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    if (!appointmentId) {
      return res
        .status(400)
        .json({ success: false, message: "Appointment ID gereklidir." });
    }

    // İlgili randevuya ait ödemeleri getiriyoruz.
    const payments = await Payment.find({ appointmentId, isDeleted: false });
    if (!payments || payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bu randevuya ait ödeme bulunamadı.",
      });
    }
    return res.status(200).json({ success: true, payments });
  } catch (err) {
    console.error("Get Payments By Appointment Error:", err);
    return res.status(500).json({
      success: false,
      message: "Ödemeler getirilirken bir hata oluştu.",
    });
  }
};

/**
 * softDeletePayment: Ödemeyi soft delete yapar (isDeleted = true)
 */
exports.softDeletePayment = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const updatedPayment = await Payment.findByIdAndUpdate(
      paymentId,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedPayment) {
      return res
        .status(404)
        .json({ success: false, message: "Ödeme bulunamadı." });
    }
    return res.status(200).json({ success: true, payment: updatedPayment });
  } catch (err) {
    console.error("Soft Delete Payment Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Ödeme silinirken bir hata oluştu." });
  }
};
