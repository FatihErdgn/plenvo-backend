const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: `.env.${process.env.NODE_ENV || "development"}` });

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
  const rolesToCreate = roleNames.filter((role) => !existingRoleNames.includes(role));

  if (rolesToCreate.length > 0) {
    await Role.insertMany(rolesToCreate.map((roleName) => ({ roleName })));
    console.log(`${rolesToCreate.length} yeni rol oluşturuldu:`, rolesToCreate);
  } else {
    console.log("Tüm roller zaten mevcut.");
  }

  // 3) Superadmin Müşterisini Kontrol Et
  let superAdminCustomer = await Customer.findOne({ customerName: "Vic Spera" });
  if (!superAdminCustomer) {
    superAdminCustomer = new Customer({
      customerName: "Vic Spera",
      countryId: null,
      customerDomain: "demo",
      appMainColor: "#000000",
      appSecondaryColor: "#ffffff",
      customerType: "individual",
    });
    await superAdminCustomer.save();
    console.log("Superadmin müşterisi oluşturuldu.");
  } else {
    console.log("Superadmin müşterisi zaten mevcut.");
  }

  // 4) SUBDOMAINS ortam değişkeninden müşteri ekleme
  const subdomains = process.env.SUBDOMAINS ? process.env.SUBDOMAINS.split(",") : [];

  for (const subdomain of subdomains) {
    let customer = await Customer.findOne({ customerDomain: subdomain });
    if (!customer) {
      customer = new Customer({
        customerName: `${subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} Müşteri`,
        countryId: null,
        customerDomain: subdomain,
        appMainColor: "#123456",
        appSecondaryColor: "#abcdef",
        customerType: "business",
      });
      await customer.save();
      console.log(`Yeni müşteri oluşturuldu: ${subdomain}`);
    } else {
      console.log(`Müşteri zaten mevcut: ${subdomain}`);
    }
  }

  // 5) Superadmin Kullanıcısını Kontrol Et
  const existingUser = await User.findOne({ username: "vic.spera" });
  if (existingUser) {
    console.log("Superadmin kullanıcı zaten mevcut.");
  } else {
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const superadminRole = await Role.findOne({ roleName: "superadmin" });

    if (!superadminRole) {
      console.error("Hata: 'superadmin' rolü bulunamadı.");
      return;
    }

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

  // 6) Para Birimlerini Ekle
  const currencies = ["TRY", "EUR", "USD"];
  for (const currencyName of currencies) {
    const existingCurrency = await Currency.findOne({ currencyName });
    if (!existingCurrency) {
      await new Currency({ currencyName }).save();
      console.log(`Yeni para birimi eklendi: ${currencyName}`);
    }
  }
}

// Dosya doğrudan çalıştırıldığında
if (require.main === module) {
  seedSuperadmin();
}

module.exports = seedSuperadmin;
