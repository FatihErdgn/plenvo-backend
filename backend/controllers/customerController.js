// controllers/customerController.js

const Customer = require("../models/Customer");
const Country = require("../models/Country");

/**
 * Yeni bir müşteri (Customer) ekleme
 */
exports.createCustomer = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    // Body'den gelecek alanlar
    const {
      customerName,
      countryId,        // Müşterinin bağlı olduğu ülke
      customerDomain,
      appMainColor,
      appSecondaryColor,
      customerType,
    } = req.body;

    // countryName de eklemek istiyorsanız, ya front-end'den gelir
    // ya da countryId üzerinden bulduğumuz veriden otomatik atarız.
    // Sizin şemanızda "countryName" required: true demişsiniz.
    // Dolayısıyla 2 seçeneğimiz var:
    // 1) Body'den countryName'i alıp direk set etmek
    // 2) countryId üzerinden bulduğumuz Country'den atamak
    // Aşağıda 2. yöntemle (bulup atama) örnek yaptım.

    const foundCountry = await Country.findById(countryId);
    if (!foundCountry) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz countryId veya ülke bulunamadı.",
      });
    }

    // Artık new Customer oluşturabiliriz
    const newCustomer = new Customer({
      customerName,
      countryId: foundCountry._id,
      countryName: foundCountry.countryName, // Şemada "countryName" zorunlu olduğu için
      customerDomain,
      appMainColor,
      appSecondaryColor,
      customerType,
    });

    await newCustomer.save();

    res.status(201).json({ success: true, message: "Customer başarıyla oluşturuldu." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Customer oluşturulamadı." });
  }
};

/**
 * Tüm müşterileri listeleme
 */
exports.getAllCustomers = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    // Soft delete (isDeleted=false) şartını da ekleyebilirsiniz
    const customers = await Customer.find({ isDeleted: false }).populate("countryId");
    res.status(200).json({ success: true, data: customers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Müşteriler getirilemedi." });
  }
};

/**
 * Tek bir müşteri getir
 */
exports.getCustomerById = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const { id } = req.params;
    const customer = await Customer.findById(id).populate("countryId");
    if (!customer || customer.isDeleted) {
      return res.status(404).json({ success: false, message: "Müşteri bulunamadı." });
    }

    res.status(200).json({ success: true, data: customer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Müşteri getirilemedi." });
  }
};

/**
 * Müşteri güncelle
 */
exports.updateCustomer = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const { id } = req.params;
    const {
      customerName,
      countryId,
      customerDomain,
      appMainColor,
      appSecondaryColor,
      customerType,
    } = req.body;

    const customer = await Customer.findById(id);
    if (!customer || customer.isDeleted) {
      return res.status(404).json({ success: false, message: "Müşteri bulunamadı." });
    }

    // countryId geldiyse, bulup set edelim
    if (countryId) {
      const foundCountry = await Country.findById(countryId);
      if (!foundCountry) {
        return res.status(400).json({
          success: false,
          message: "Geçersiz countryId veya ülke bulunamadı.",
        });
      }
      customer.countryId = foundCountry._id;
      customer.countryName = foundCountry.countryName; // mecburi
    }

    if (customerName !== undefined) customer.customerName = customerName;
    if (customerDomain !== undefined) customer.customerDomain = customerDomain;
    if (appMainColor !== undefined) customer.appMainColor = appMainColor;
    if (appSecondaryColor !== undefined) customer.appSecondaryColor = appSecondaryColor;
    if (customerType !== undefined) customer.customerType = customerType;

    await customer.save();

    res.status(200).json({ success: true, message: "Müşteri başarıyla güncellendi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Müşteri güncellenemedi." });
  }
};

/**
 * Müşteri silme (soft delete)
 */
exports.deleteCustomer = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer || customer.isDeleted) {
      return res.status(404).json({ success: false, message: "Müşteri bulunamadı." });
    }

    // Soft delete
    customer.isDeleted = true;
    await customer.save();

    res.status(200).json({ success: true, message: "Müşteri başarıyla silindi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Müşteri silinemedi." });
  }
};
