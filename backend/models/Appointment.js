// models/Appointment.js
const mongoose = require("mongoose");
const crypto = require("crypto");

// Randevuya katılanların (participants) alt şeması
const participantSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phoneNumber: { type: String },
    gender: { type: String },
    age: { type: Number }
  },
  { _id: false } // Her participant için ayrı _id üretme
);

// actions alt nesnesi şeması
const actionsSchema = new mongoose.Schema(
  {
    payNow: { type: Boolean, default: false },
    reBook: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    view: { type: Boolean, default: false }
  },
  { _id: false }
);

// Asıl appointment şeması
const appointmentSchema = new mongoose.Schema({
  // JSON'daki "id" değeri
  customerId: {type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true},
  countryId: {type: mongoose.Schema.Types.ObjectId, ref: "Country", required: true},
  clinicId: {type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true},
  // single / group
  type: {
    type: String,
    required: true,
    enum: ["single", "group"] // İsterseniz enum kullanabilirsiniz
  },

  firstName: { type: String },
  lastName: { type: String },
  phoneNumber: { type: String },

  // "13-Aug-2023 10:00:00" gibi string'i kaydederken Date'e çevirerek ekleyebilirsiniz
  appointmentDateTime: { type: Date, required: true },

  // Örnek: "Açık", "Ödeme Bekleniyor", "Tamamlandı", "İptal Edildi" ...
  // Sabitlemek isterseniz enum tanımlayabilirsiniz
  status: { type: String, required: true },

  // Alt nesne
  actions: actionsSchema,

  gender: { type: String },
  age: { type: Number },
  clinic: { type: String },
  doctor: { type: String },
  uniqueCode: { type: String, required: true, unique: true },

  // Grup randevuları için katılımcı listesi
  participants: [participantSchema],
  isDeleted: { type: Boolean, default: false }, // Soft delete alanı
});

appointmentSchema.pre("save", function (next) {
  if (!this.uniqueCode) {
    // first time
    this.uniqueCode = crypto.randomBytes(4).toString("hex");
  }
  next();
});

module.exports = mongoose.model("Appointment", appointmentSchema);