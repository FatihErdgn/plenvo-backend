// controllers/paymentController.js
const Payment = require("../models/Payment");
const Appointment = require("../models/Appointment");
const CalendarAppointment = require("../models/CalendarAppointment");
const Currency = require("../models/Currency");
const Services = require("../models/Services");
const mongoose = require("mongoose");

/**
 * Ödeme periyoduna göre bitiş tarihini hesaplayan yardımcı fonksiyon
 * @param {String} period - Ödeme periyodu (monthly, quarterly, biannual)
 * @param {Date} startDate - Başlangıç tarihi (artık kullanılmıyor)
 * @param {Date} appointmentDate - Randevu tarihi
 * @returns {Date|null} - Periyot bitiş tarihi veya null
 */
const calculatePeriodEndDate = (period, startDate, appointmentDate = null) => {
  // Debug: Gelen parametreleri kontrol et
  console.log("calculatePeriodEndDate - Gelen periyot:", period);
  console.log("calculatePeriodEndDate - Gelen startDate:", startDate);
  console.log("calculatePeriodEndDate - Gelen appointmentDate:", appointmentDate);
  
  // Sağlam tarih kontrolü
  let validStartDate, validAppointmentDate;
  
  // startDate kontrolü
  try {
    validStartDate = startDate instanceof Date ? startDate : new Date(startDate);
    if (isNaN(validStartDate.getTime())) {
      console.log("calculatePeriodEndDate - UYARI: Geçersiz startDate, şimdiki zamanı kullanıyorum");
      validStartDate = new Date();
    }
  } catch (e) {
    console.error("calculatePeriodEndDate - startDate dönüşüm hatası:", e);
    validStartDate = new Date();
  }
  
  // appointmentDate kontrolü
  try {
    validAppointmentDate = appointmentDate instanceof Date ? appointmentDate : 
                          (appointmentDate ? new Date(appointmentDate) : null);
    
    if (validAppointmentDate && isNaN(validAppointmentDate.getTime())) {
      console.log("calculatePeriodEndDate - UYARI: Geçersiz appointmentDate, startDate kullanıyorum");
      validAppointmentDate = null;
    }
  } catch (e) {
    console.error("calculatePeriodEndDate - appointmentDate dönüşüm hatası:", e);
    validAppointmentDate = null;
  }
  
  // Artık randevu tarihini referans noktası olarak kullanıyoruz
  // Eğer validAppointmentDate null ise, validStartDate'i kullanırız
  const referenceDate = validAppointmentDate || validStartDate;
  
  console.log("calculatePeriodEndDate - Kullanılan referans tarihi:", referenceDate);
  console.log("calculatePeriodEndDate - Referans tarih ISO formatı:", referenceDate.toISOString());
  
  // Referans tarihten bir kopya oluştur (orijinal tarihi değiştirmemek için)
  const endDate = new Date(referenceDate);
  
  switch(period) {
    case "monthly":
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case "quarterly":
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case "biannual":
      endDate.setMonth(endDate.getMonth() + 6);
      break;
    case "single":
    default:
      // Tek seferlik ödemeler için sadece belirli randevu tarihi için geçerli olacak
      if (validAppointmentDate) {
        // Randevu günü boyunca geçerli olması için gün sonuna ayarla
        endDate.setHours(23, 59, 59, 999);
        console.log("calculatePeriodEndDate - Hesaplanan bitiş tarihi (tek seferlik):", endDate.toISOString());
        return endDate;
      }
      return null; // Tarih belirtilmediyse null döndür
  }
  
  // Periyodun son gününün tamamını kapsaması için gün sonuna ayarla
  endDate.setHours(23, 59, 59, 999);
  
  console.log("calculatePeriodEndDate - Hesaplanan bitiş tarihi:", endDate.toISOString());
  return endDate;
};

/**
 * createPayment: Bir randevu için ödeme oluşturur.
 * İstenen alanlar:
 *  - currencyId (frontend'den gönderilen para birimi ID'si)
 *  - serviceIds: Seçilen hizmetlerin ID'leri (array)
 *  - paymentMethod, paymentAmount, paymentDescription
 *  - appointmentId: Hangi randevu için ödeme yapılıyor
 *  - paymentPeriod: Ödeme periyodu (single, monthly, quarterly, biannual)
 *
 * Token'dan alınan customerId, randevudan alınan doctorId (userId) kullanılır.
 * Seçilen hizmetlerin toplam ücreti (serviceFee) ve hizmet adları hesaplanır.
 *
 * Ek olarak: Ödeme kaydı oluşturulduktan sonra,
 * - Ödenen miktar toplam hizmet ücretine eşit ya da fazlaysa randevunun durumu "Tamamlandı"
 *   ve ilgili action'lar güncellenecektir.
 * - Ödenen miktar toplam ücretin altında ise randevu durumu "Ödeme Bekleniyor" olarak güncellenecektir.
 *
 * Eğer Appointment şemasında randevu bulunamazsa, CalendarAppointment şemasına bakılır.
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
      paymentPeriod = "single", // Yeni: ödeme periyodu (varsayılan: tek seferlik)
      actualAppointmentDate, // Yeni: frontend'den gelen instance'ın gerçek tarihi
    } = req.body;

    if (
      !currencyName ||
      !serviceIds ||
      !paymentMethod ||
      !appointmentId
    ) {
      return res.status(400).json({
        success: false,
        message: "Gerekli tüm ödeme alanları doldurulmalıdır.",
      });
    }

    // paymentAmount alanı için özel kontrol
    if (paymentAmount === undefined || paymentAmount === null) {
      return res.status(400).json({
        success: false,
        message: "Ödeme tutarı belirtilmelidir.",
      });
    }

    // Ödeme periyodu validasyonu
    if (!["single", "monthly", "quarterly", "biannual"].includes(paymentPeriod)) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz ödeme periyodu. Geçerli değerler: single, monthly, quarterly, biannual",
      });
    }

    const customerId = req.user.customerId;
    if (!customerId) {
      return res
        .status(401)
        .json({ success: false, message: "Müşteri kimliği bulunamadı." });
    }

    // Randevuyu önce Appointment, bulunamazsa CalendarAppointment'dan çekiyoruz.
    let appointment = await Appointment.findById(appointmentId);
    let isCalendar = false;
    if (!appointment) {
      appointment = await CalendarAppointment.findById(appointmentId);
      if (appointment) isCalendar = true;
    }
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Randevu bulunamadı." });
    }
    const userId = appointment.doctorId;

    // Randevunun "Ön Görüşme" özel durumu için kontrol
    const isOnGorusme = appointment.appointmentType === "Ön Görüşme";

    // Seçilen hizmetlerin detaylarını getiriyoruz.
    let services = [];
    let totalServiceFee = 0;
    let serviceDescriptions = [];

    // Eğer serviceIds varsa ve boş değilse hizmetleri getir
    if (serviceIds && serviceIds.length > 0) {
      services = await Services.find({
        _id: { $in: serviceIds.map((id) => new mongoose.Types.ObjectId(id)) },
        isDeleted: false,
        status: "Aktif",
      });
      
      // Normal durum için kontrol: "Ön Görüşme" değilse ve hizmet bulunamadıysa hata döndür
      if (services.length === 0 && !isOnGorusme) {
        return res.status(400).json({
          success: false,
          message: "Seçilen hizmetler bulunamadı veya aktif değil.",
        });
      }
      
      totalServiceFee = services.reduce((sum, svc) => sum + svc.serviceFee, 0);
      serviceDescriptions = services.map((svc) => svc.serviceName);
    } else if (!isOnGorusme) {
      // "Ön Görüşme" değilse ve serviceIds yoksa hata döndür
      return res.status(400).json({
        success: false,
        message: "Hizmet seçilmelidir.",
      });
    }
    
    // "Ön Görüşme" için özel durum: Hizmet yoksa bile devam et, ücret 0 TL
    if (isOnGorusme && services.length === 0) {
      totalServiceFee = 0;
      serviceDescriptions = ["Ön Görüşme Hizmeti"];
    }

    const paymentDateFinal = paymentDate ? new Date(paymentDate) : new Date();

    // Debug: Frontend'den gelen tarih bilgisini kontrol et
    console.log("createPayment - Frontend'den gelen actualAppointmentDate:", actualAppointmentDate);
    console.log("createPayment - DB'den gelen appointment.appointmentDate:", appointment.appointmentDate);
    
    // Periyot bitiş tarihini hesapla - artık frontend'den gelen gerçek instance tarihini kullanıyoruz
    // Eğer actualAppointmentDate gönderilmişse onu, yoksa veritabanındaki appointment.appointmentDate'i kullan
    let dateToUse;
    
    if (actualAppointmentDate) {
      try {
        dateToUse = new Date(actualAppointmentDate);
        
        // Geçersiz tarih kontrolü
        if (isNaN(dateToUse.getTime())) {
          console.log("createPayment - UYARI: Geçersiz actualAppointmentDate formatı, DB tarihi kullanılacak");
          dateToUse = appointment.appointmentDate;
        }
      } catch (e) {
        console.error("createPayment - Tarih çevirme hatası:", e);
        dateToUse = appointment.appointmentDate;
      }
    } else {
      dateToUse = appointment.appointmentDate;
    }
    
    // Eğer appointment.appointmentDate bir string ise Date objesine çevir
    if (typeof dateToUse === 'string') {
      dateToUse = new Date(dateToUse);
    }
    
    // Debug: Hesaplamada kullanılan tarihi kontrol et
    console.log("createPayment - Kullanılan tarih (dateToUse):", dateToUse);
    console.log("createPayment - dateToUse tarih tipi:", typeof dateToUse);
    console.log("createPayment - dateToUse instanceof Date:", dateToUse instanceof Date);
    console.log("createPayment - dateToUse ISO formatı:", dateToUse instanceof Date ? dateToUse.toISOString() : "Tarih değil");
    
    const periodEndDate = calculatePeriodEndDate(paymentPeriod, paymentDateFinal, dateToUse);
    
    // Debug: Hesaplanan periyot bitiş tarihini kontrol et
    console.log("createPayment - Hesaplanan periyot bitiş tarihi:", periodEndDate);
    console.log("createPayment - periodEndDate ISO formatı:", periodEndDate instanceof Date ? periodEndDate.toISOString() : "Tarih değil");

    const foundCurrency = await Currency.findOne({ currencyName });
    if (!foundCurrency) {
      return res
        .status(400)
        .json({ success: false, message: "Para birimi bulunamadı." });
    }

    // Ödeme durumunu belirle - sadece ödeme miktarına bağlı olarak
    const paymentStatus = paymentAmount >= totalServiceFee 
      ? "Tamamlandı" 
      : "Ödeme Bekleniyor";

    const newPayment = new Payment({
      customerId,
      currencyId: foundCurrency._id,
      userId,
      serviceId: serviceIds && serviceIds.length > 0 ? serviceIds : [],
      appointmentId,
      paymentMethod,
      paymentAmount,
      paymentDate: paymentDateFinal,
      paymentStatus: paymentStatus,
      paymentDescription,
      serviceFee: totalServiceFee,
      serviceDescription: serviceDescriptions.join(", "),
      paymentPeriod, // Ödeme periyodu
      periodEndDate, // Periyot bitiş tarihi
      isDeleted: false,
    });

    const savedPayment = await newPayment.save();

    // Randevu durumunu güncelle:
    if (paymentAmount >= totalServiceFee) {
      if (isCalendar) {
        // Aynı bookingId'ye sahip tüm CalendarAppointment'ları güncelle
        await CalendarAppointment.updateMany(
          { bookingId: appointment.bookingId },
          {
            status: "Tamamlandı",
            actions: {
              payNow: false,
              reBook: true,
              edit: false,
              view: true,
            },
          }
        );
      } else {
        appointment.status = "Tamamlandı";
        appointment.actions = {
          payNow: false,
          reBook: true,
          edit: false,
          view: true,
        };
        await appointment.save();
      }
    } else {
      if (isCalendar) {
        await CalendarAppointment.updateMany(
          { bookingId: appointment.bookingId },
          {
            status: "Ödeme Bekleniyor",
            actions: {
              payNow: true,
              reBook: false,
              edit: true,
              view: true,
            },
          }
        );
      } else {
        appointment.status = "Ödeme Bekleniyor";
        appointment.actions = {
          payNow: true,
          reBook: false,
          edit: true,
          view: true,
        };
        await appointment.save();
      }
    }

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
 *
 * Eğer Appointment şemasında randevu bulunamazsa, CalendarAppointment şemasına bakılır.
 */
exports.updatePayment = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const updateData = req.body;
    
    // Mevcut ödemeyi bul
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Ödeme bulunamadı." });
    }
    
    // İlgili randevuyu bul
    const appointmentId = payment.appointmentId;
    let appointment = await Appointment.findById(appointmentId);
    let isCalendar = false;
    if (!appointment) {
      appointment = await CalendarAppointment.findById(appointmentId);
      if (appointment) isCalendar = true;
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Randevu bulunamadı." });
      }
    }
    
    // Eğer ödeme periyodu değiştiyse, periyot bitiş tarihini tekrar hesapla
    if (updateData.paymentPeriod) {
      const paymentDate = updateData.paymentDate ? new Date(updateData.paymentDate) : payment.paymentDate;
      
      // Debug: Frontend'den gelen tarih bilgisini kontrol et
      console.log("updatePayment - Frontend'den gelen actualAppointmentDate:", updateData.actualAppointmentDate);
      console.log("updatePayment - DB'den gelen appointment.appointmentDate:", appointment.appointmentDate);
      
      // Frontend'den gelen gerçek instance tarihini kullan (varsa)
      let dateToUse;
      
      if (updateData.actualAppointmentDate) {
        try {
          dateToUse = new Date(updateData.actualAppointmentDate);
          
          // Geçersiz tarih kontrolü
          if (isNaN(dateToUse.getTime())) {
            console.log("updatePayment - UYARI: Geçersiz actualAppointmentDate formatı, DB tarihi kullanılacak");
            dateToUse = appointment.appointmentDate;
          }
        } catch (e) {
          console.error("updatePayment - Tarih çevirme hatası:", e);
          dateToUse = appointment.appointmentDate;
        }
      } else {
        dateToUse = appointment.appointmentDate;
      }
      
      // Eğer appointment.appointmentDate bir string ise Date objesine çevir
      if (typeof dateToUse === 'string') {
        dateToUse = new Date(dateToUse);
      }
      
      // Debug: Hesaplamada kullanılan tarihi kontrol et
      console.log("updatePayment - Kullanılan tarih (dateToUse):", dateToUse);
      console.log("updatePayment - dateToUse tarih tipi:", typeof dateToUse);
      console.log("updatePayment - dateToUse instanceof Date:", dateToUse instanceof Date);
      console.log("updatePayment - dateToUse ISO formatı:", dateToUse instanceof Date ? dateToUse.toISOString() : "Tarih değil");
        
      // Randevu tarihini referans alarak periyot bitiş tarihini hesapla
      updateData.periodEndDate = calculatePeriodEndDate(updateData.paymentPeriod, paymentDate, dateToUse);
      
      // Debug: Hesaplanan periyot bitiş tarihini kontrol et
      console.log("updatePayment - Hesaplanan periyot bitiş tarihi:", updateData.periodEndDate);
      console.log("updatePayment - periodEndDate ISO formatı:", updateData.periodEndDate instanceof Date ? updateData.periodEndDate.toISOString() : "Tarih değil");
    }

    // Güncellemeyi uygula
    const updatedPayment = await Payment.findByIdAndUpdate(
      paymentId,
      updateData,
      { new: true }
    );
    
    if (appointment) {
      let cumulativePaid, totalServiceFee;
      
      if (isCalendar) {
        const bookingId = appointment.bookingId;
        const relatedAppointments = await CalendarAppointment.find({
          bookingId,
        });
        const relatedAppointmentIds = relatedAppointments.map(
          (appt) => appt._id
        );
        const paymentsAgg = await Payment.aggregate([
          {
            $match: {
              appointmentId: { $in: relatedAppointmentIds },
              isDeleted: false,
            },
          },
          { $group: { _id: null, totalPaid: { $sum: "$paymentAmount" } } },
        ]);
        cumulativePaid = paymentsAgg[0]?.totalPaid || 0;
        totalServiceFee = updatedPayment.serviceFee;
        let newStatus, newActions;
        
        if (cumulativePaid >= totalServiceFee) {
          newStatus = "Tamamlandı";
          newActions = {
            payNow: false,
            reBook: true,
            edit: false,
            view: true,
          };
        } else {
          newStatus = "Ödeme Bekleniyor";
          newActions = {
            payNow: true,
            reBook: false,
            edit: true,
            view: true,
          };
        }
        await CalendarAppointment.updateMany(
          { bookingId: appointment.bookingId },
          { status: newStatus, actions: newActions }
        );
      } else {
        const paymentsAgg = await Payment.aggregate([
          { $match: { appointmentId: appointmentId, isDeleted: false } },
          { $group: { _id: null, totalPaid: { $sum: "$paymentAmount" } } },
        ]);
        cumulativePaid = paymentsAgg[0]?.totalPaid || 0;
        totalServiceFee = updatedPayment.serviceFee;
        
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
 * Eğer randevu Appointment şemasında bulunamazsa, CalendarAppointment şemasına bakılır.
 * 
 * Artık ödeme periyodunu da kontrol ediyor: Randevu tarihi periyot bitiş tarihinden sonraysa, ödeme geçerli değil.
 * Tek seferlik ödemeler, sadece ödeme yapılan randevu için geçerlidir.
 */
exports.getPaymentsByAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    const { instanceDate } = req.query; // Frontend'den gelen instance tarihi
    
    if (!appointmentId) {
      return res
        .status(400)
        .json({ success: false, message: "Appointment ID gereklidir." });
    }

    // Önce Appointment'da arıyoruz; yoksa CalendarAppointment'dan çekiyoruz.
    let appointment = await Appointment.findById(appointmentId);
    let isCalendar = false;
    if (!appointment) {
      appointment = await CalendarAppointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Bu randevuya ait ödeme bulunamadı.",
        });
      }
      isCalendar = true;
    }

    // Randevu tarihi alınıyor - instance tarihi kullanılır veya DB'den çekilir
    let appointmentDate;
    if (instanceDate) {
      // Query parameter olarak gelen tarihi kullan
      appointmentDate = new Date(instanceDate);
      if (isNaN(appointmentDate.getTime())) {
        // Geçersiz tarih gönderilmişse randevunun kendi tarihini kullan
        appointmentDate = appointment.appointmentDate;
      }
    } else if (isCalendar) {
      if (typeof appointmentId === 'string' && appointmentId.includes('_instance_')) {
        const instanceDateString = appointmentId.split('_instance_')[1];
        appointmentDate = new Date(instanceDateString);
      } else {
        appointmentDate = appointment.appointmentDate;
      }
    } else {
      appointmentDate = appointment.appointmentDate;
    }

    let payments;
    if (isCalendar) {
      // Aynı bookingId'ye sahip tüm CalendarAppointment'ların _id'lerini alıyoruz.
      const bookingId = appointment.bookingId;
      const relatedAppointments = await CalendarAppointment.find({ bookingId });
      const relatedAppointmentIds = relatedAppointments.map((appt) => appt._id);
      
      // Tüm ödemeleri al
      const allPayments = await Payment.find({
        appointmentId: { $in: relatedAppointmentIds },
        isDeleted: false,
      });
      
      // Ödemelerin geçerlilik durumlarını belirle ve filtreleme yap
      payments = allPayments.map(payment => {
        // Her ödeme için geçerlilik durumunu hesapla
        let isValid = false;
        
        // Tek seferlik ödemeler (single) için özel kontrol:
        if (payment.paymentPeriod === 'single') {
          // Eğer randevu ID "_instance_" içeriyorsa, parent ID'ye eşit mi diye kontrol et
          if (typeof appointmentId === 'string' && appointmentId.includes('_instance_')) {
            const parentId = appointmentId.split('_instance_')[0];
            isValid = payment.appointmentId.toString() === parentId;
          } else {
            // Normal randevularda direkt eşitliği kontrol et
            isValid = payment.appointmentId.toString() === appointmentId;
          }
        } else {
          // Periyotlu ödemeler için: Randevu tarihi ödeme periyodunun bitiş tarihinden önce mi?
          if (!payment.periodEndDate) {
            isValid = true; // Periyot bitiş tarihi yoksa her zaman geçerli
          } else {
            const periodEnd = new Date(payment.periodEndDate);
            isValid = appointmentDate <= periodEnd;
          }
        }
        
        // Payment objesinin bir kopyasını oluştur
        const paymentObj = payment.toObject();
        
        // ÖNEMLİ: isValid'e ek olarak, isCompleted değerini de ekle
        // Bir ödeme ancak:
        // 1. Geçerli (isValid) VE
        // 2. Tamamlanmış (paymentStatus === "Tamamlandı")
        // ise tamamlanmış sayılır
        paymentObj.isValid = isValid;
        paymentObj.isCompleted = isValid && payment.paymentStatus === "Tamamlandı";
        
        return paymentObj;
      });
      
      // Önce geçerli-tamamlanmış, sonra geçerli-tamamlanmamış, en son geçersiz ödemeleri göster
      payments.sort((a, b) => {
        if (a.isCompleted && !b.isCompleted) return -1;
        if (!a.isCompleted && b.isCompleted) return 1;
        if (a.isValid && !b.isValid) return -1;
        if (!a.isValid && b.isValid) return 1;
        return 0;
      });
    } else {
      const allPayments = await Payment.find({ appointmentId, isDeleted: false });
      
      // Ödemelerin geçerlilik durumlarını belirle
      payments = allPayments.map(payment => {
        // Her ödeme için geçerlilik durumunu hesapla
        let isValid = false;
        
        // Tekrarlı olmayan randevularda tek seferlik ödemeler her zaman geçerli
        if (payment.paymentPeriod === 'single') {
          isValid = true;
        } else {
          // Periyotlu ödemeler için tarih kontrolü
          if (!payment.periodEndDate) {
            isValid = true; // Periyot bitiş tarihi yoksa her zaman geçerli
          } else {
            const periodEnd = new Date(payment.periodEndDate);
            isValid = appointmentDate <= periodEnd;
          }
        }
        
        // Payment objesinin bir kopyasını oluştur
        const paymentObj = payment.toObject();
        
        // ÖNEMLİ: isValid'e ek olarak, isCompleted değerini de ekle
        // Bir ödeme ancak:
        // 1. Geçerli (isValid) VE
        // 2. Tamamlanmış (paymentStatus === "Tamamlandı")
        // ise tamamlanmış sayılır
        paymentObj.isValid = isValid;
        paymentObj.isCompleted = isValid && payment.paymentStatus === "Tamamlandı";
        
        return paymentObj;
      });
      
      // Önce geçerli-tamamlanmış, sonra geçerli-tamamlanmamış, en son geçersiz ödemeleri göster
      payments.sort((a, b) => {
        if (a.isCompleted && !b.isCompleted) return -1;
        if (!a.isCompleted && b.isCompleted) return 1;
        if (a.isValid && !b.isValid) return -1;
        if (!a.isValid && b.isValid) return 1;
        return 0;
      });
    }

    // Eğer ödeme kaydı yoksa 404 yerine 200 dönüp boş liste gönderebilirsiniz
    if (!payments || payments.length === 0) {
      return res.status(200).json({
        success: true,
        payments: [],
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
 * softDeletePayment: Ödemeyi soft delete yapar (isDeleted = true).
 * Eğer randevu Appointment şemasında bulunamazsa, CalendarAppointment şemasına bakılır.
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

    const appointmentId = updatedPayment.appointmentId;
    let appointment = await Appointment.findById(appointmentId);
    let isCalendar = false;
    if (!appointment) {
      appointment = await CalendarAppointment.findById(appointmentId);
      if (appointment) isCalendar = true;
    }
    if (appointment) {
      let cumulativePaid, totalServiceFee;
      
      if (isCalendar) {
        const bookingId = appointment.bookingId;
        const relatedAppointments = await CalendarAppointment.find({
          bookingId,
        });
        const relatedAppointmentIds = relatedAppointments.map(
          (appt) => appt._id
        );
        const paymentsAgg = await Payment.aggregate([
          {
            $match: {
              appointmentId: { $in: relatedAppointmentIds },
              isDeleted: false,
            },
          },
          { $group: { _id: null, totalPaid: { $sum: "$paymentAmount" } } },
        ]);
        cumulativePaid = paymentsAgg[0]?.totalPaid || 0;
        totalServiceFee = updatedPayment.serviceFee;
        let newStatus, newActions;
        
        if (cumulativePaid >= totalServiceFee) {
          newStatus = "Tamamlandı";
          newActions = {
            payNow: false,
            reBook: true,
            edit: false,
            view: true,
          };
        } else {
          newStatus = "Ödeme Bekleniyor";
          newActions = {
            payNow: true,
            reBook: false,
            edit: true,
            view: true,
          };
        }
        await CalendarAppointment.updateMany(
          { bookingId: appointment.bookingId },
          { status: newStatus, actions: newActions }
        );
      } else {
        const paymentsAgg = await Payment.aggregate([
          { $match: { appointmentId: appointmentId, isDeleted: false } },
          { $group: { _id: null, totalPaid: { $sum: "$paymentAmount" } } },
        ]);
        cumulativePaid = paymentsAgg[0]?.totalPaid || 0;
        totalServiceFee = updatedPayment.serviceFee;
        
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
    }

    return res.status(200).json({ success: true, payment: updatedPayment });
  } catch (err) {
    console.error("Soft Delete Payment Error:", err);
    return res.status(500).json({
      success: false,
      message: "Ödeme silinirken bir hata oluştu.",
    });
  }
};
