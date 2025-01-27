const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  // Artık sadece roleId tutuyoruz
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },

  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    // Eğer superadmin ise customerId zorunlu değil
    required: false,
  },

  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clinic",
    // Eğer superadmin ise clinicId zorunlu değil
    required: false,
  },

  username: { type: String, required: true, unique: true },
  userMail: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  firstName: { type: String, required: true },
  lastName: { type: String, required: true },

  phoneNumber: { type: String },

  profession: { type: String },
  speciality: { type: String },
  salary: { type: Number },
  hireDate: { type: Date },

  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Şifre hashleme
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Şifre karşılaştırma metodu
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
