const Customer = require("../models/Customer");

/**
 * Subdomain veya API'den gelen isteklere göre müşteri bulma fonksiyonu
 */
const getCustomerFromSubdomain = async (hostname, req) => {
  // Localhost veya 127.0.0.1 ise dev ortamı
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const localCustomer = await Customer.findOne({ customerDomain: "demo" });
    return localCustomer || null;
  }

  // Normalde hostname'in ilk kısmı subdomain
  let subdomain = hostname.split(".")[0];

  // Eğer API isteği geliyorsa, subdomain'i 'origin' veya 'referer' başlığından almaya çalış
  if (subdomain === "api") {
    const origin = req?.headers?.origin || req?.headers?.referer;
    if (origin) {
      try {
        const url = new URL(origin);
        subdomain = url.hostname.split(".")[0];
        console.log(`🔄 API isteği algılandı, gerçek subdomain: ${subdomain}`);
      } catch (error) {
        console.log(`❌ URL parse hatası: ${error.message}`);
      }
    } else {
      console.log("❌ API isteği var ama 'origin' veya 'referer' başlığı bulunamadı!");
    }
  }

  // Subdomain'e göre müşteriyi bul
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
    const hostname = req.headers.host.split(":")[0]; // Port varsa çıkar
    console.log(`🌍 Gelen Hostname: ${hostname}`);

    const customer = await getCustomerFromSubdomain(hostname, req); // ✅ `req` parametresini ekledik

    if (!customer) {
      console.log(`❌ Müşteri bulunamadı: ${hostname}`);
      return res.status(404).json({
        success: false,
        message: `Müşteri bulunamadı veya aktif değil: ${hostname}`,
      });
    }

    console.log(`✅ Bulunan Müşteri: ${customer.customerDomain}, ID: ${customer._id}`);
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
 * Eğer kullanıcı superadmin değilse, sadece kendi müşteriId'sine ait subdomain'e erişebilsin.
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
