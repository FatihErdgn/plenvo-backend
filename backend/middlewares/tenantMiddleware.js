// middlewares/tenant.js
const Customer = require("../models/Customer");

/**
 * Development ortamında "localhost" için 'localdev' adlı bir customerDomain kullanıyoruz.
 * Subdomain mantığını da hostname.split('.')[0] ile alıyoruz.
 */
const getCustomerFromSubdomain = async (hostname) => {
  // Localhost veya 127.0.0.1 ise dev ortamı
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const localCustomer = await Customer.findOne({ customerDomain: "localdev" });
    return localCustomer || null;
  }

  // Aksi halde, hostname'in ilk kısmı subdomain
  // Ör: "someclinic.myapp.com" => "someclinic"
  const subdomain = hostname.split(".")[0];
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
    // Port varsa ayıklayalım (örn: localhost:3000)
    const hostname = req.headers.host.split(":")[0];
    const customer = await getCustomerFromSubdomain(hostname);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Müşteri bulunamadı veya aktif değil.",
      });
    }

    req.customer = customer; // Bu customer'ı diğer yerlerde kullanabiliriz
    next();
  } catch (err) {
    console.error("resolveCustomer error:", err);
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
