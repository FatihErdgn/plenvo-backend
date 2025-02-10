// middlewares/tenant.js
const Customer = require("../models/Customer");
const jwt = require("jsonwebtoken");
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
    // Eğer authorization header varsa, token içinden customerId al
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      console.log("❌ Token bulunamadı, müşteri çözümlenemedi.");
      return res
        .status(401)
        .json({ success: false, message: "Yetkisiz giriş." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.customerId) {
      console.log(`❌ Kullanıcı veya customerId bulunamadı: ${decoded.id}`);
      return res
        .status(404)
        .json({
          success: false,
          message: "Müşteri bulunamadı veya aktif değil.",
        });
    }

    const customer = await Customer.findById(user.customerId);

    if (!customer) {
      console.log(`❌ Müşteri kaydı bulunamadı: ${user.customerId}`);
      return res
        .status(404)
        .json({
          success: false,
          message: "Müşteri bulunamadı veya aktif değil.",
        });
    }

    console.log(
      `✅ Bulunan Müşteri: ${customer.customerDomain}, ID: ${customer._id}`
    );
    req.customer = customer;
    next();
  } catch (err) {
    console.error("❌ resolveCustomer error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Müşteri çözümlenemedi." });
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
