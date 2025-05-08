const Services = require("../models/Services");
const Currency = require("../models/Currency");
/**
 * createService: Yeni bir servis (hizmet) oluşturur.
 * Beklenen req.body alanları:
 *  - serviceName, provider, validityDate, serviceFee, serviceDescription, currencyId
 *  - (Opsiyonel) actions ve status (varsayılan "active")
 *
 * Token üzerinden:
 *  - customerId, clinicId, userId (ilk oluşturucu)
 *  - lastEditBy ve lastEditDate ayarlanır.
 */
exports.createService = async (req, res) => {
  try {
    // Sadece admin ve superadmin bu işlemi yapabilir
    const { role } = req.user; // JWT'den gelen role
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }
    const {
      serviceName,
      provider,
      validityDate,
      serviceFee,
      serviceType,
      currencyName,
      status,
      isSmsReminderActive,
    } = req.body;

    // Gerekli alanların kontrolü
    if (
      !serviceName ||
      !provider ||
      !validityDate ||
      !serviceFee ||
      !currencyName ||
      !serviceType
    ) {
      return res.status(400).json({
        success: false,
        message: "Tüm zorunlu alanlar doldurulmalıdır.",
      });
    }

    // Tarih validasyonu
    const parsedValidityDate = new Date(validityDate);
    if (isNaN(parsedValidityDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz validityDate formatı.",
      });
    }

    const foundCurrency = await Currency.findOne({ currencyName });
    if (!foundCurrency) {
      return res.status(404).json({
        success: false,
        message: "Belirtilen para birimi bulunamadı.",
      });
    }

    if (!serviceType) {
      return res.status(400).json({
        success: false,
        message: "Service type is required.",
      });
    }
    // Token üzerinden alınan bilgiler (authentication middleware req.user'ı doldurmalı)
    const customerId = req.user.customerId;
    const clinicId = req.user.clinicId;
    const userId = req.user.userId; // Servisi oluşturan kişi
    const lastEditBy = req.user.userId;

    const newService = new Services({
      customerId,
      clinicId,
      userId,
      currencyId: foundCurrency._id,
      serviceName,
      provider,
      validityDate: parsedValidityDate,
      serviceType,
      serviceFee,
      status: status || "active",
      isSmsReminderActive: isSmsReminderActive || false,
      isDeleted: false,
      lastEditBy,
    });

    const savedService = await newService.save();
    return res.status(201).json({ success: true, service: savedService });
  } catch (err) {
    console.error("Create Service Error:", err);
    return res.status(500).json({
      success: false,
      message: "Servis oluşturulurken bir hata oluştu.",
    });
  }
};

/**
 * updateService: Varolan bir servisi günceller.
 * - req.params.id ile servisin ID'si, req.body ile güncellenmek istenen alanlar gönderilir.
 * - validityDate güncelleniyorsa, tarih validasyonu yapılır.
 * - lastEditBy ve lastEditDate token üzerinden güncellenir.
 */
exports.updateService = async (req, res) => {
  try {
    const { role } = req.user; // JWT'den gelen role
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }
    const serviceId = req.params.id;
    const updateData = req.body;

    if (updateData.validityDate) {
      const parsedDate = new Date(updateData.validityDate);
      if (isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Geçersiz validityDate formatı." });
      }
      updateData.validityDate = parsedDate;
    }

    // Güncelleme sırasında lastEditBy ve lastEditDate ayarlanır.
    updateData.lastEditBy = req.user.userId;
    updateData.lastEditDate = new Date();

    const updatedService = await Services.findByIdAndUpdate(
      serviceId,
      updateData,
      { new: true }
    );
    if (!updatedService) {
      return res
        .status(404)
        .json({ success: false, message: "Servis bulunamadı." });
    }
    return res.status(200).json({ success: true, service: updatedService });
  } catch (err) {
    console.error("Update Service Error:", err);
    return res.status(500).json({
      success: false,
      message: "Servis güncellenirken bir hata oluştu.",
    });
  }
};

/**
 * softDeleteService: Servisi soft delete yapar (isDeleted = true).
 */
exports.softDeleteService = async (req, res) => {
  try {
    const serviceId = req.params.id;
    const updateData = {
      isDeleted: true,
      lastEditBy: req.user._id,
      lastEditDate: new Date(),
    };

    const deletedService = await Services.findByIdAndUpdate(
      serviceId,
      updateData,
      { new: true }
    );
    if (!deletedService) {
      return res
        .status(404)
        .json({ success: false, message: "Servis bulunamadı." });
    }
    return res.status(200).json({ success: true, service: deletedService });
  } catch (err) {
    console.error("Soft Delete Service Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Servis silinirken bir hata oluştu." });
  }
};

/**
 * getServices: İlgili müşteriye ait servisleri (sayfalama destekli) getirir.
 */
exports.getServices = async (req, res) => {
  try {
    // Token üzerinden gelen customerId'ye göre filtreleme
    const customerId = req.user.customerId;
    const query = customerId
      ? { customerId, isDeleted: false }
      : { isDeleted: false };

    const services = await Services.find(query)
      .populate({ path: "currencyId", select: "currencyName" })
      .sort({ validityDate: -1 }) // En güncel validityDate'e göre sıralama
      .lean();

    const transformedServices = services.map((service) => {
      return {
        ...service,
        currencyName: service.currencyId.currencyName,
      };
    });

    return res.status(200).json({
      success: true,
      data: transformedServices,
    });
  } catch (err) {
    console.error("Get Services Error:", err);
    return res.status(500).json({
      success: false,
      message: "Servisler alınırken bir hata oluştu.",
    });
  }
};
