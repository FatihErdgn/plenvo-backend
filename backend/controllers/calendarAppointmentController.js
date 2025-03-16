// controllers/calendarAppointmentController.js
const CalendarAppointment = require("../models/CalendarAppointment");
const mongoose = require("mongoose");
const User = require("../models/User");

/**
 * GET /pilates-schedule?doctorId=...
 * Belirli doktora (veya hepsine) ait randevuları getirir.
 */
exports.getCalendarAppointments = async (req, res) => {
  try {
    const { doctorId } = req.query;
    const customerId = req.user.customerId; // JWT'den

    const matchStage = { customerId: new mongoose.Types.ObjectId(customerId) };
    if (doctorId) {
      matchStage.doctorId = new mongoose.Types.ObjectId(doctorId);
    }

    const appointments = await CalendarAppointment.aggregate([
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
      return res
        .status(403)
        .json({
          success: false,
          message: "Doktorun randevu oluşturma yetkisi yok.",
        });
    }

    const { doctorId, dayIndex, timeIndex, participants, description, bookingId } =
      req.body;
    const customerId = req.user.customerId;

    // Basit validasyon
    if (doctorId == null || dayIndex == null || timeIndex == null) {
      return res
        .status(400)
        .json({ success: false, message: "Eksik alanlar var." });
    }

    // Eğer front-end bookingId göndermediyse yeni oluştur.
    const finalBookingId = bookingId || new mongoose.Types.ObjectId().toString();

    // Randevu oluştur
    const newAppointment = new CalendarAppointment({
      customerId,
      doctorId,
      dayIndex,
      timeIndex,
      participants,
      description, // Açıklama alanını ekledik
      bookingId: finalBookingId,
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
    const { doctorId, dayIndex, timeIndex, participants, description } =
      req.body;
    const customerId = req.user.customerId;

    const appointment = await CalendarAppointment.findById(appointmentId);
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Randevu bulunamadı." });
    }
    if (appointment.customerId.toString() !== customerId.toString()) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Farklı müşteri verisine erişim yok.",
        });
    }

    // Güncellemeler (bookingId sabit kalır)
    appointment.doctorId = doctorId || appointment.doctorId;
    appointment.dayIndex = dayIndex ?? appointment.dayIndex;
    appointment.timeIndex = timeIndex ?? appointment.timeIndex;
    appointment.participants = participants || appointment.participants;
    appointment.description = description ?? appointment.description; // Açıklamayı güncelle

    await appointment.save();
    return res.json({ success: true, data: appointment });
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
      return res
        .status(403)
        .json({ success: false, message: "Doktorun silme yetkisi yok." });
    }

    const appointmentId = req.params.id;
    const customerId = req.user.customerId;

    const appointment = await CalendarAppointment.findById(appointmentId);
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Randevu bulunamadı." });
    }
    if (appointment.customerId.toString() !== customerId.toString()) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Farklı müşteri verisine erişim yok.",
        });
    }

    await appointment.deleteOne();
    return res.json({ success: true, message: "Randevu silindi." });
  } catch (err) {
    console.error("deleteCalendarAppointment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
