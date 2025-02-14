const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");
require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const Role = require("./models/Role");
const Customer = require("./models/Customer");
const User = require("./models/User");
const Currency = require("./models/Currency");

// Konsoldan soru sormak için yardımcı fonksiyon
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Asıl seed fonksiyonu
async function seedSuperadmin() {
  console.log("Seed işlemi başladı...");

  // 1) MongoDB'ye bağlan
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
  let superAdminCustomer = await Customer.findOne({
    customerName: "Vic Spera",
  });
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

  // 4) .env'deki SUBDOMAINS ortam değişkeninden müşteri ekleme
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

      // Yeni müşteri için SMS ayarlarını sor
      const smsActiveAnswer = await askQuestion(`Müşteri ${subdomain} için SMS aktif edilsin mi? (yes/no): `);
      if (smsActiveAnswer.toLowerCase() === "yes") {
        const smsApiKey = await askQuestion("SMS API anahtarını giriniz: ");
        const smsSenderId = await askQuestion("SMS gönderici adını giriniz: ");
        customer.isSmsActive = true;
        customer.smsApiKey = smsApiKey;
        customer.smsSenderId = smsSenderId;
        await customer.save();
        console.log(`Müşteri ${subdomain} için SMS ayarları güncellendi.`);
      } else {
        console.log(`Müşteri ${subdomain} için SMS devre dışı bırakıldı.`);
      }
    } else {
      console.log(`Müşteri zaten mevcut: ${subdomain}`);
    }
  }

  // 5) Her müşteri için bir Superadmin Kullanıcısı Oluştur
  const customers = await Customer.find({});

  for (const customer of customers) {
    const uniqueUsername = `vic.spera_${customer.customerDomain}`;

    const existingUser = await User.findOne({ username: uniqueUsername });

    if (!existingUser) {
      const password = process.env.SUPER_ADMIN_PASSWORD;
      const superadminRole = await Role.findOne({ roleName: "superadmin" });

      if (!superadminRole) {
        console.error("Hata: 'superadmin' rolü bulunamadı.");
        return;
      }

      const superadminUser = new User({
        username: uniqueUsername,
        userMail: `admin@${customer.customerDomain}.com`,
        firstName: "Vic",
        lastName: "Spera",
        roleId: superadminRole._id,
        customerId: customer._id,
        clinicId: null,
        phoneNumber: null,
        password: password,
      });

      await superadminUser.save();
      console.log(`Superadmin oluşturuldu: ${uniqueUsername} - Müşteri: ${customer.customerDomain}`);
    } else {
      console.log(`Superadmin zaten mevcut: ${uniqueUsername} - Müşteri: ${customer.customerDomain}`);
    }
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

  console.log("Seed işlemi tamamlandı.");
}

// Dosya doğrudan çalıştırıldığında
if (require.main === module) {
  seedSuperadmin();
}

module.exports = seedSuperadmin;
