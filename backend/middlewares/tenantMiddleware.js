// middlewares/tenant.js
const Customer = require("../models/Customer");

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
  let subdomain = hostname.split(".")[0];

  // Eğer API üzerinden geliyorsa, orijinal subdomain'i 'origin' veya 'referer' başlığından al
  if (subdomain === "api") {
    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      const url = new URL(origin);
      subdomain = url.hostname.split(".")[0];
      console.log(`🔄 API isteği algılandı, gerçek subdomain: ${subdomain}`);
    } else {
      console.log("❌ API isteği var ama origin veya referer yok!");
    }
  }

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
    const hostname = req.headers.host.split(":")[0];
    console.log(`🌍 Gelen Hostname: ${hostname}`); // ✅ Hostname logla

    const customer = await getCustomerFromSubdomain(hostname);

    if (!customer) {
      console.log(`❌ Müşteri bulunamadı: ${hostname}`); // ✅ Müşteri bulunamazsa logla
      return res.status(404).json({
        success: false,
        message: `Müşteri bulunamadı veya aktif değil: ${hostname}`,
      });
    }

    console.log(
      `✅ Bulunan Müşteri: ${customer.customerDomain}, ID: ${customer._id}`
    ); // ✅ Müşteri bulundu logla
    req.customer = customer;
    next();
  } catch (err) {
    console.error("❌ resolveCustomer error:", err);
    res.status(500).json({
      success: false,
      message: "Tenant (müşteri) çözümlenemedi.",
    });
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
