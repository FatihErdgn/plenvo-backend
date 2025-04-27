// controllers/calendarAppointmentController.js
const CalendarAppointment = require("../models/CalendarAppointment");
const mongoose = require("mongoose");
const User = require("../models/User");

/**
 * Türkiye telefon numarası formatını kontrol eden yardımcı fonksiyon
 * 0 ile başlayan 10-11 haneli numara (05xx xxx xx xx formatı)
 */
const validateTurkishPhoneNumber = (phone) => {
  if (!phone) return true; // Boş numara kabul edilebilir
  
  // 0 ile başlayan 10-11 haneli numara kontrolü
  const regex = /^0[5][0-9]{8,9}$/;
  return regex.test(phone);
};

/**
 * GET /pilates-schedule?doctorId=...
 * Belirli doktora (veya hepsine) ait randevuları getirir.
 */
exports.getCalendarAppointments = async (req, res) => {
  try {
    const { doctorId, weekStart } = req.query;
    const customerId = req.user.customerId; // JWT'den

    const matchStage = { customerId: new mongoose.Types.ObjectId(customerId) };
    if (doctorId) {
      matchStage.doctorId = new mongoose.Types.ObjectId(doctorId);
    }

    // Tekrarlı randevuları olan veri setini tutacak
    let appointments = [];

    // Eğer weekStart parametresi varsa, o haftaya ait randevuları getir
    if (weekStart) {
      const startDate = new Date(weekStart);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);
      
      // Tarihleri UTC olarak ayarla
      startDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCHours(23, 59, 59, 999);
      
      matchStage.appointmentDate = { 
        $gte: startDate, 
        $lt: endDate 
      };

      // Önce veritabanındaki tüm randevuları getir
      const dbAppointments = await CalendarAppointment.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: "users", // Users koleksiyon ismi (DB'deki ismi kontrol et)
            localField: "doctorId",
            foreignField: "_id",
            as: "doctor",
          },
        },
        {
          $addFields: {
            doctorName: {
              $cond: {
                if: { $gt: [{ $size: "$doctor" }, 0] },
                then: {
                  $concat: [
                    { $arrayElemAt: ["$doctor.firstName", 0] },
                    " ",
                    { $arrayElemAt: ["$doctor.lastName", 0] },
                  ],
                },
                else: "Unknown",
              },
            },
          },
        },
        { $project: { doctor: 0 } }, // Gereksiz doctor dizisini kaldır
      ]);

      // Veritabanından gelen randevularda katılımcı ve telefon numaralarını birleştir
      const processedAppointments = dbAppointments.map(appt => {
        // Katılımcı telefon numaralarını katılımcı objelerine ekle
        const participants = appt.participants.map((participant, index) => {
          return {
            name: participant.name,
            phone: appt.participantsTelNumbers && appt.participantsTelNumbers[index] 
              ? appt.participantsTelNumbers[index]
              : ""
          };
        });
        
        // Güncellenmiş katılımcı listesini randevuya ekle
        return {
          ...appt,
          participants
        };
      });

      appointments = [...processedAppointments];

      // Şimdi tekrarlı randevuları kontrol et - bu tarih için tekrarlanan ancak veritabanında olmayan randevular
      // Tekrarlı randevuları almak için ek sorgu yap
      const recurringQuery = {
        customerId: new mongoose.Types.ObjectId(customerId),
        isRecurring: true,
        // endDate null veya weekStart'tan sonra
        $or: [
          { endDate: null },
          { endDate: { $gte: startDate } }
        ]
      };
      
      if (doctorId) {
        recurringQuery.doctorId = new mongoose.Types.ObjectId(doctorId);
      }
      
      // Tüm tekrarlı randevuları getir
      const recurringAppointments = await CalendarAppointment.find(recurringQuery);
      
      // Her tekrarlı randevu için, bu hafta için bir instance oluştur
      // Promise.all ile her bir async işlemi bekle
      await Promise.all(recurringAppointments.map(async (appt) => {
        // Eğer bu randevu veritabanında zaten varsa tekrar oluşturma
        const exists = appointments.some(a => 
          a.dayIndex === appt.dayIndex && 
          a.timeIndex === appt.timeIndex &&
          new Date(a.appointmentDate).toDateString() === new Date(appt.appointmentDate).toDateString()
        );
        
        if (!exists) {
          // Bu randevunun dayIndex'ine göre bu hafta içindeki uygun günü bul
          const weekDay = (startDate.getDay() + 6) % 7; // 0 = Pazar, 1 = Pazartesi, ..., 6 = Cumartesi
          const daysToAdd = (appt.dayIndex - weekDay + 7) % 7;
          const appointmentDate = new Date(startDate);
          appointmentDate.setDate(appointmentDate.getDate() + daysToAdd);
          
          // Eğer appointmentDate, randevunun endDate'inden önce ve ilk randevu tarihinden sonra ise ve istisnalarda değilse
          const isException = appt.recurringExceptions?.some(
            ex => new Date(ex).toDateString() === appointmentDate.toDateString()
          );
          
          // Randevunun ilk oluşturulduğu tarihi kontrol et
          const originalAppointmentDate = new Date(appt.appointmentDate);
          
          // Sadece ilk randevu tarihinden sonraki tarihleri göster
          if (!isException && 
              (!appt.endDate || appointmentDate <= appt.endDate) && 
              appointmentDate >= originalAppointmentDate) {
            // Doktor bilgilerini getir
            const doctor = await User.findById(appt.doctorId);
            const doctorName = doctor ? `${doctor.firstName} ${doctor.lastName}` : "Unknown";
            
            // Katılımcı telefon numaralarını katılımcı objelerine ekle
            const participants = appt.participants.map((participant, index) => {
              return {
                name: participant.name,
                phone: appt.participantsTelNumbers && appt.participantsTelNumbers[index] 
                  ? appt.participantsTelNumbers[index]
                  : ""
              };
            });
            
            // Bu haftaki instance'ı oluştur
            appointments.push({
              ...appt.toObject(),
              _id: appt._id.toString() + "_instance_" + appointmentDate.toISOString().split('T')[0],
              appointmentDate: appointmentDate,
              doctorName: doctorName, // Doktor adını ekle
              participants: participants, // Telefon numarasını içeren katılımcı listesi
              recurringParentType: appt.appointmentType, // Randevu tipini parent'tan al
              isVirtualInstance: true // Bu özellik, frontend'de bu randevunun gerçekte veritabanında olmadığını gösterecek
            });
          }
        }
      }));

      // Gün ve saate göre sırala
      appointments.sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
        return a.timeIndex - b.timeIndex;
      });
    }

    return res.json({ success: true, data: appointments });
  } catch (err) {
    console.error("getCalendarAppointments error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /pilates-schedule
 * Yeni randevu oluşturur. Sadece admin/manager/superadmin yapabilsin.
 */
exports.createCalendarAppointment = async (req, res) => {
  try {
    const { role } = req.user; // "doctor", "admin", ...
    if (role === "doctor") {
      return res.status(403).json({
        success: false,
        message: "Doktorun randevu oluşturma yetkisi yok.",
      });
    }

    const { 
      doctorId, 
      dayIndex, 
      timeIndex, 
      participants,
      description, 
      bookingId, 
      appointmentDate,
      isRecurring = true,
      endDate = null,
      appointmentType = "" // Yeni: Randevu Tipi
    } = req.body;
    
    const customerId = req.user.customerId;

    // Basit validasyon
    if (doctorId == null || dayIndex == null || timeIndex == null) {
      return res
        .status(400)
        .json({ success: false, message: "Eksik alanlar var." });
    }

    // Katılımcı validasyonu - en az bir katılımcı olmalı ve her birinin adı olmalı
    if (!participants || participants.length === 0 || participants.some(p => !p.name || p.name.trim() === '')) {
      return res
        .status(400)
        .json({ success: false, message: "En az bir katılımcı ekleyin ve tüm katılımcıların adını girin." });
    }
    
    // Telefon numarası validasyonu
    const invalidPhoneNumbers = participants.filter(p => p.phone && !validateTurkishPhoneNumber(p.phone));
    if (invalidPhoneNumbers.length > 0) {
      return res
        .status(400)
        .json({ 
          success: false, 
          message: "Telefon numaraları 0 ile başlamalı ve 05XX XXX XX XX formatında olmalıdır." 
        });
    }

    // Participants'dan phone değerlerini al ve participantsTelNumbers dizisine kaydet
    const participantsTelNumbers = participants.map(p => p.phone || "");

    // Eğer front-end bookingId göndermediyse yeni oluştur.
    const finalBookingId = bookingId || new mongoose.Types.ObjectId().toString();

    // Randevu oluştur
    const newAppointment = new CalendarAppointment({
      customerId,
      doctorId,
      dayIndex,
      timeIndex,
      participants: participants.map(p => ({ name: p.name })), // Sadece name alanını al
      participantsTelNumbers, // Telefon numaralarını ayrı dizide kaydet
      description,
      bookingId: finalBookingId,
      appointmentDate,
      isRecurring,
      endDate: endDate ? new Date(endDate) : null,
      appointmentType // Yeni: Randevu Tipi
    });

    await newAppointment.save();
    return res.json({ success: true, data: newAppointment });
  } catch (err) {
    console.error("createCalendarAppointment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * PUT /pilates-schedule/:id
 * Randevuyu günceller. Sadece admin/manager/superadmin.
 */
exports.updateCalendarAppointment = async (req, res) => {
  try {
    const { role } = req.user;
    if (role === "doctor") {
      return res
        .status(403)
        .json({ success: false, message: "Doktorun güncelleme yetkisi yok." });
    }

    const appointmentId = req.params.id;
    const { 
      doctorId, 
      dayIndex, 
      timeIndex, 
      participants, 
      description, 
      appointmentDate,
      isRecurring,
      endDate,
      appointmentType, // Yeni: Randevu Tipi
      updateAllInstances = false // Bu parametre tüm serinin mi yoksa sadece bir instance'ın mı güncelleneceğini belirler
    } = req.body;
    
    const customerId = req.user.customerId;
    
    // Telefon numarası validasyonu (eğer participants varsa)
    if (participants) {
      const invalidPhoneNumbers = participants.filter(p => p.phone && !validateTurkishPhoneNumber(p.phone));
      if (invalidPhoneNumbers.length > 0) {
        return res
          .status(400)
          .json({ 
            success: false, 
            message: "Telefon numaraları 0 ile başlamalı ve 05XX XXX XX XX formatında olmalıdır." 
          });
      }
    }
    
    // Telefon numaralarını katılımcılardan çıkar
    const participantsTelNumbers = participants ? participants.map(p => p.phone || "") : null;
    // Sadece isim bilgisini içeren katılımcı listesi oluştur
    const participantsWithoutPhone = participants ? participants.map(p => ({ name: p.name })) : null;

    // Sanal instance mi kontrol et
    if (appointmentId.includes("_instance_")) {
      // Bu bir sanal instance, parent randevuyu güncelle
      const parentId = appointmentId.split("_instance_")[0];
      const instanceDate = appointmentId.split("_instance_")[1];
      
      const parentAppointment = await CalendarAppointment.findById(parentId);
      if (!parentAppointment) {
        return res.status(404).json({ success: false, message: "Randevu bulunamadı." });
      }
      
      if (parentAppointment.customerId.toString() !== customerId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Farklı müşteri verisine erişim yok.",
        });
      }
      
      if (updateAllInstances) {
        // Tüm seriyi güncelle
        parentAppointment.doctorId = doctorId || parentAppointment.doctorId;
        parentAppointment.dayIndex = dayIndex ?? parentAppointment.dayIndex;
        parentAppointment.timeIndex = timeIndex ?? parentAppointment.timeIndex;
        parentAppointment.participants = participantsWithoutPhone || parentAppointment.participants;
        parentAppointment.participantsTelNumbers = participantsTelNumbers || parentAppointment.participantsTelNumbers;
        parentAppointment.description = description ?? parentAppointment.description;
        parentAppointment.isRecurring = isRecurring ?? parentAppointment.isRecurring;
        parentAppointment.endDate = endDate ? new Date(endDate) : parentAppointment.endDate;
        parentAppointment.appointmentType = appointmentType ?? parentAppointment.appointmentType; // Yeni: Randevu Tipi
        
        await parentAppointment.save();
        return res.json({ success: true, data: parentAppointment });
      } else {
        // Sadece bu instance'ı istisna olarak işaretle ve yeni bir tek seferlik randevu oluştur
        const exceptionDate = new Date(instanceDate);
        
        // İstisna olarak işaretle
        if (!parentAppointment.recurringExceptions.some(d => 
          new Date(d).toDateString() === exceptionDate.toDateString())) {
          parentAppointment.recurringExceptions.push(exceptionDate);
          await parentAppointment.save();
        }
        
        // Bu tarih için yeni bir tek seferlik randevu oluştur
        const newAppointment = new CalendarAppointment({
          customerId,
          doctorId: doctorId || parentAppointment.doctorId,
          dayIndex: dayIndex ?? parentAppointment.dayIndex,
          timeIndex: timeIndex ?? parentAppointment.timeIndex,
          participants: participantsWithoutPhone || parentAppointment.participants,
          participantsTelNumbers: participantsTelNumbers || parentAppointment.participantsTelNumbers,
          description: description ?? parentAppointment.description,
          bookingId: parentAppointment.bookingId,
          appointmentDate: exceptionDate,
          isRecurring: false,
          recurringParentId: parentAppointment._id,
          appointmentType: appointmentType ?? parentAppointment.appointmentType // Yeni: Randevu Tipi
        });
        
        await newAppointment.save();
        return res.json({ success: true, data: newAppointment });
      }
    } else {
      // Normal randevu güncelleme
      const appointment = await CalendarAppointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Randevu bulunamadı." });
      }
      
      if (appointment.customerId.toString() !== customerId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Farklı müşteri verisine erişim yok.",
        });
      }
      
      // Güncelleme
      appointment.doctorId = doctorId || appointment.doctorId;
      appointment.dayIndex = dayIndex ?? appointment.dayIndex;
      appointment.timeIndex = timeIndex ?? appointment.timeIndex;
      appointment.participants = participantsWithoutPhone || appointment.participants;
      appointment.participantsTelNumbers = participantsTelNumbers || appointment.participantsTelNumbers;
      appointment.description = description ?? appointment.description;
      appointment.appointmentDate = appointmentDate ?? appointment.appointmentDate;
      appointment.isRecurring = isRecurring ?? appointment.isRecurring;
      appointment.endDate = endDate ? new Date(endDate) : appointment.endDate;
      appointment.appointmentType = appointmentType ?? appointment.appointmentType; // Yeni: Randevu Tipi
      
      await appointment.save();
      return res.json({ success: true, data: appointment });
    }
  } catch (err) {
    console.error("updateCalendarAppointment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * DELETE /pilates-schedule/:id
 * Randevuyu siler. Sadece admin/manager/superadmin.
 */
exports.deleteCalendarAppointment = async (req, res) => {
  try {
    const { role } = req.user;
    if (role === "doctor") {
      return res.status(403).json({ success: false, message: "Doktorun silme yetkisi yok." });
    }

    const appointmentId = req.params.id;
    const customerId = req.user.customerId;
    const { deleteMode = "single" } = req.query; // 'single', 'afterThis', 'allSeries'

    // Sanal instance mi kontrol et
    if (appointmentId.includes("_instance_")) {
      // Bu bir sanal instance, parent randevuyu bul
      const parentId = appointmentId.split("_instance_")[0];
      const instanceDate = appointmentId.split("_instance_")[1];
      
      const parentAppointment = await CalendarAppointment.findById(parentId);
      if (!parentAppointment) {
        return res.status(404).json({ success: false, message: "Randevu bulunamadı." });
      }
      
      if (parentAppointment.customerId.toString() !== customerId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Farklı müşteri verisine erişim yok.",
        });
      }
      
      if (deleteMode === 'allSeries') {
        // Tüm seriyi sil
        await parentAppointment.deleteOne();
        return res.json({ success: true, message: "Tüm tekrarlı randevular silindi." });
      } else if (deleteMode === 'afterThis') {
        // Bu tarihten sonraki tüm tekrarları sil (endDate'i bu tarih olarak ayarla)
        const exceptionDate = new Date(instanceDate);
        
        // Bu tarih için istisnayı ekleyelim (bu tarihi de dahil etme)
        if (!parentAppointment.recurringExceptions.some(d => 
          new Date(d).toDateString() === exceptionDate.toDateString())) {
          parentAppointment.recurringExceptions.push(exceptionDate);
        }
        
        // endDate'i bu tarihe ayarla (bir gün öncesi olmalı)
        const newEndDate = new Date(exceptionDate);
        newEndDate.setDate(newEndDate.getDate() - 1);
        parentAppointment.endDate = newEndDate;
        
        await parentAppointment.save();
        return res.json({ success: true, message: "Bu tarihten sonraki tüm tekrarlı randevular silindi." });
      } else {
        // Sadece bu instance'ı istisna olarak işaretle
        const exceptionDate = new Date(instanceDate);
        
        if (!parentAppointment.recurringExceptions.some(d => 
          new Date(d).toDateString() === exceptionDate.toDateString())) {
          parentAppointment.recurringExceptions.push(exceptionDate);
          await parentAppointment.save();
        }
        
        return res.json({ success: true, message: "Randevu bu tarih için silindi." });
      }
    } else {
      // Normal randevu silme
      const appointment = await CalendarAppointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Randevu bulunamadı." });
      }
      
      if (appointment.customerId.toString() !== customerId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Farklı müşteri verisine erişim yok.",
        });
      }
      
      await appointment.deleteOne();
      return res.json({ success: true, message: "Randevu silindi." });
    }
  } catch (err) {
    console.error("deleteCalendarAppointment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
