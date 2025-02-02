// controllers/paymentController.js

const Payment = require("../models/Payment");
const Appointment = require("../models/Appointment");
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
 * Seçilen hizmetlerin toplam ücreti ve adları hesaplanır.
 */
exports.createPayment = async (req, res) => {
  try {
    const {
      currencyId,
      serviceIds, // array
      paymentMethod,
      paymentAmount,
      paymentDescription,
      appointmentId,
      paymentDate // opsiyonel
    } = req.body;

    // Gerekli alan kontrolü
    if (!currencyId || !serviceIds || !paymentMethod || !paymentAmount || !paymentDescription || !appointmentId) {
      return res.status(400).json({ success: false, message: "Gerekli tüm ödeme alanları doldurulmalıdır." });
    }

    // customerId token üzerinden
    const customerId = req.user.customerId;
    if (!customerId) {
      return res.status(401).json({ success: false, message: "Müşteri kimliği bulunamadı." });
    }

    // Randevuyu getirerek doctorId (userId) al
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Randevu bulunamadı." });
    }
    const userId = appointment.doctorId;

    // Seçilen hizmetlerin (serviceIds) detaylarını getir
    const services = await Services.find({
      _id: { $in: serviceIds.map(id => mongoose.Types.ObjectId(id)) },
      isDeleted: false,
      status: "active"
    });
    if (services.length === 0) {
      return res.status(400).json({ success: false, message: "Seçilen hizmetler bulunamadı veya aktif değil." });
    }
    const totalServiceFee = services.reduce((sum, svc) => sum + svc.serviceFee, 0);
    const serviceDescriptions = services.map(svc => svc.serviceName);

    // Ödeme tarihi: verilmediyse şimdiki tarih
    const paymentDateFinal = paymentDate ? new Date(paymentDate) : new Date();

    // Ödeme şeması: Eğer Payment şemasında serviceId alanını array yapmak istiyorsanız, 
    // burada "serviceIds" olarak atayın. (Şema güncellemesi gerekebilir.)
    const newPayment = new Payment({
      customerId,
      currencyId,
      userId,
      serviceId: serviceIds, // Dikkat: Eğer şema array değilse, buna uygun olarak dönüştürün.
      appointmentId,
      paymentMethod,
      paymentAmount,
      paymentDate: paymentDateFinal,
      paymentStatus: "Ödeme Bekleniyor", // Başlangıçta
      paymentDescription,
      // Yeni eklenen alanlar:
      serviceFee: totalServiceFee, // Toplam hizmet ücreti
      serviceDescription: serviceDescriptions.join(", "),
      isDeleted: false
    });

    const savedPayment = await newPayment.save();
    return res.status(201).json({ success: true, payment: savedPayment });
  } catch (err) {
    console.error("Create Payment Error:", err);
    return res.status(500).json({ success: false, message: "Ödeme oluşturulurken bir hata oluştu." });
  }
};

/**
 * updatePayment: Mevcut ödemeyi günceller (örneğin kısmi ödeme durumu veya ek hizmet güncellemesi)
 */
exports.updatePayment = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const updateData = req.body;

    const updatedPayment = await Payment.findByIdAndUpdate(paymentId, updateData, { new: true });
    if (!updatedPayment) {
      return res.status(404).json({ success: false, message: "Ödeme bulunamadı." });
    }
    return res.status(200).json({ success: true, payment: updatedPayment });
  } catch (err) {
    console.error("Update Payment Error:", err);
    return res.status(500).json({ success: false, message: "Ödeme güncellenirken bir hata oluştu." });
  }
};

/**
 * softDeletePayment: Ödemeyi soft delete yapar (isDeleted = true)
 */
exports.softDeletePayment = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const updatedPayment = await Payment.findByIdAndUpdate(paymentId, { isDeleted: true }, { new: true });
    if (!updatedPayment) {
      return res.status(404).json({ success: false, message: "Ödeme bulunamadı." });
    }
    return res.status(200).json({ success: true, payment: updatedPayment });
  } catch (err) {
    console.error("Soft Delete Payment Error:", err);
    return res.status(500).json({ success: false, message: "Ödeme silinirken bir hata oluştu." });
  }
};
