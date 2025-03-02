const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    // Sadece roleId tutuyoruz
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: false, // Eğer superadmin ise customerId zorunlu değil
    },

    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: false, // Eğer superadmin ise clinicId zorunlu değil
    },

    username: { type: String, required: true },
    userMail: { type: String, required: false },
    password: { type: String, required: true },

    firstName: { type: String, required: true },
    lastName: { type: String, required: true },

    phoneNumber: { type: String, required: false },

    profession: { type: String },
    speciality: { type: String },
    salary: { type: Number },
    hireDate: { type: Date },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true, // `createdAt` ve `updatedAt` otomatik olarak yönetilir
  }
);

// Partial index tanımları: isDeleted false olan kayıtlar için benzersizlik kontrolü
UserSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
UserSchema.index(
  { userMail: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

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
