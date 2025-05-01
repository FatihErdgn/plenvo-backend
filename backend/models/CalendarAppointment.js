// models/CalendarAppointment.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const calendarAppointmentSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dayIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    timeIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 11,
    },
    participants: [
      {
        name: String,
      },
    ],
    participantsTelNumbers: [
      {
        type: String,
      },
    ],
    description: {
      type: String,
      default: "",
    },
    bookingId: {
      type: String,
      default: null,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    // Yeni: Randevu Tipi alanı
    appointmentType: {
      type: String,
      enum: ["Ön Görüşme", "Rutin Görüşme", "Muayene", ""],
      default: "",
    },
    // Tekrarlı randevular için yeni alanlar
    isRecurring: {
      type: Boolean,
      default: true, // Varsayılan olarak tüm randevular tekrarlı olsun
    },
    endDate: {
      type: Date,
      default: null, // Null ise sonsuza kadar tekrarlanır
    },
    recurringParentId: {
      type: Schema.Types.ObjectId,
      ref: "CalendarAppointment",
      default: null, // Ana tekrarlı randevu ID'si
    },
    recurringExceptions: {
      type: [Date], // İptal edilen veya değiştirilen tekrarlı randevu tarihleri
      default: [],
    },
    reminderSent: {
      type: Boolean,
      default: false // WhatsApp hatırlatma gönderildi mi
    },
    smsImmediateSent: {
      type: Boolean,
      default: false, // SMS anında gönderildi mi
    },
    smsReminderSent: {
      type: Boolean,
      default: false, // SMS hatırlatma gönderildi mi
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CalendarAppointment", calendarAppointmentSchema);
