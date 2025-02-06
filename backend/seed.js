// scripts/seedSuperadmin.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Role = require("./models/Role");
const Customer = require("./models/Customer");
const User = require("./models/User");
const Currency = require("./models/Currency");

// Asıl seed fonksiyon
async function seedSuperadmin() {
  console.log("Seed işlemi başladı...");

  // 1) MongoDB bağlan
  await mongoose.connect(process.env.DB_URI);
  console.log("MongoDB bağlandı.");

  // 2) Roller var mı kontrol et, eksikleri oluştur
  const roleNames = ["superadmin", "consultant", "doctor", "manager", "admin"];
  const existingRoles = await Role.find({ roleName: { $in: roleNames } });
  const existingRoleNames = existingRoles.map((role) => role.roleName);
  const rolesToCreate = roleNames.filter(
    (role) => !existingRoleNames.includes(role)
  );

  if (rolesToCreate.length > 0) {
    await Role.insertMany(rolesToCreate.map((roleName) => ({ roleName })));
    console.log(`${rolesToCreate.length} yeni rol oluşturuldu:`, rolesToCreate);
  } else {
    console.log("Tüm roller zaten mevcut.");
  }

  let superAdminCustomer = await Customer.findOne({
    customerName: "Vic Spera",
  });
  if (!superAdminCustomer) {
    superAdminCustomer = new Customer({
      customerName: "Vic Spera",
      countryId: null,
      customerDomain: "localdev",
      appMainColor: "#000000",
      appSecondaryColor: "#ffffff",
      customerType: "individual",
    });
    await superAdminCustomer.save();
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

  // yeni currency
  const currencyTRY = new Currency({
    currencyName: "TRY",
  });

  // yeni currency
  const currencyEUR = new Currency({
    currencyName: "EUR",
  });

  // yeni currency
  const currencyUSD = new Currency({
    currencyName: "USD",
  });

  await currencyTRY.save();
  await currencyEUR.save();
  await currencyUSD.save();
  console.log("para birimleri oluşturuldu.");
}

// Bu dosya tek başına çalıştırılınca devreye girsin:
if (require.main === module) {
  seedSuperadmin();
}

// Eğer başka yerden import etmek isterseniz:
module.exports = seedSuperadmin;
