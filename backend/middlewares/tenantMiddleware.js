// middlewares/tenant.js
const Customer = require("../models/Customer");
const User = require("../models/User");

/**
 * Development ortamında "localhost" için 'localdev' adlı bir customerDomain kullanıyoruz.
 * Subdomain mantığını da hostname.split('.')[0] ile alıyoruz.
 */
const getCustomerFromSubdomain = async (hostname) => {
  // Localhost veya 127.0.0.1 ise dev ortamı
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const localCustomer = await Customer.findOne({
      customerDomain: "localdev",
    });
    return localCustomer || null;
  }

  // Aksi halde, hostname'in ilk kısmı subdomain
  // Ör: "someclinic.myapp.com" => "someclinic"
  const subdomain = hostname.replace(".plenvo.app", ""); // 🔥 SADECE SUBDOMAIN AL
  const customer = await Customer.findOne({
    customerDomain: subdomain,
    isDeleted: false,
  });
  return customer;
};

/**
 * Subdomain üzerinden Customer'ı bulup request'e ekler.
 * Eğer bulamazsak 404 dönüyoruz.
 */

exports.resolveCustomer = async (req, res, next) => {
  try {
    // Eğer login isteği ise, request body'den username'i al
    const isLoginRoute = req.path === "/api/auth/login";
    let customerId = null;

    if (isLoginRoute && req.body.username) {
      console.log(`🔄 Login isteği alındı, username: ${req.body.username}`);

      // Kullanıcıyı username'den çekip customerId'yi bul
      const user = await User.findOne({ username: req.body.username });

      if (user && user.customerId) {
        customerId = user.customerId;
        console.log(`✅ Kullanıcının müşteri ID'si bulundu: ${customerId}`);
      } else {
        console.log(`❌ Kullanıcı bulunamadı veya customerId atanmadı: ${req.body.username}`);
        return res.status(404).json({ success: false, message: "Müşteri bulunamadı veya aktif değil." });
      }
    }

    // Eğer müşteri ID bulunduysa, ona ait müşteri kaydını çek
    const customer = customerId ? await Customer.findById(customerId) : null;

    if (!customer) {
      console.log("❌ Müşteri bulunamadı veya aktif değil.");
      return res.status(404).json({ success: false, message: "Müşteri bulunamadı veya aktif değil." });
    }

    console.log(`✅ Bulunan Müşteri: ${customer.customerDomain}, ID: ${customer._id}`);
    req.customer = customer;
    next();
  } catch (err) {
    console.error("❌ resolveCustomer error:", err);
    return res.status(500).json({ success: false, message: "Müşteri çözümlenemedi." });
  }
};

/**
 * Eğer kullanıcı superadmin değilse, sadece kendi müşteriId'sine
 * ait subdomain'e erişebilsin.
 */
exports.checkCustomerAccess = (req, res, next) => {
  const userCustomerId = req.user.customerId?.toString();
  const requestedCustomerId = req.customer._id.toString();

  // Eğer kullanıcı superadmin ise sınırsız erişim
  if (req.user.role === "superadmin") {
    return next();
  }

  // Kullanıcı süperadmin değil, ama token'daki customerId bu subdomain'le eşleşmiyorsa engelle
  if (userCustomerId !== requestedCustomerId) {
    return res.status(403).json({
      success: false,
      message: "Bu müşteri için yetkiniz yok.",
    });
  }

  next();
};
