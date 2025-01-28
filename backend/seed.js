// scripts/seedSuperadmin.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Role = require("./models/Role");
const Customer = require("./models/Customer");
const User = require("./models/User");

// Asıl seed fonksiyon
async function seedSuperadmin() {
  console.log("Seed işlemi başladı...");

  // 1) MongoDB bağlan
  await mongoose.connect(process.env.DB_URI);
  console.log("MongoDB bağlandı.");

  // 2) "superadmin" rolünü bul veya oluştur
  let superadminRole = await Role.findOne({ roleName: "superadmin" });
  if (!superadminRole) {
    superadminRole = await Role.create({ roleName: "superadmin" });
    console.log("superadmin rolü oluşturuldu.");
  } else {
    console.log("superadmin rolü zaten mevcut.");
  }

  let superAdminCustomer = await Customer.findOne({
    customerName: "Vic Spera",
  });
  if (!superAdminCustomer) {
    superAdminCustomer = await Customer.create({
      customerName: "Vic Spera",
      countryId: null,
      customerDomain: "localdev",
      appMainColor: "#000000",
      appSecondaryColor: "#ffffff",
      customerType: "individual",
    });
    console.log("Superadmin müşterisi oluşturuldu.");
  } else {
    console.log("Superadmin müşterisi zaten mevcut.");
  }

  // 3) Kullanıcı var mı?
  const existingUser = await User.findOne({ username: "vic.spera" });
  if (existingUser) {
    console.log("Superadmin kullanıcı zaten mevcut.");
  } else {
    // Şifre
    const password = process.env.SUPER_ADMIN_PASSWORD;
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Yeni User
    const superadminUser = new User({
      username: "vic.spera",
      userMail: "info@vicspera.co.uk",
      firstName: "Vic",
      lastName: "Spera",
      roleId: superadminRole._id,
      customerId: null,
      clinicId: null,
      phoneNumber: null,
      password: password,
    });

    await superadminUser.save();
    console.log("Superadmin kullanıcı oluşturuldu.");
  }
}

// Bu dosya tek başına çalıştırılınca devreye girsin:
if (require.main === module) {
  seedSuperadmin();
}

// Eğer başka yerden import etmek isterseniz:
module.exports = seedSuperadmin;
