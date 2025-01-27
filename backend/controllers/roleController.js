// controllers/roleController.js
const Role = require("../models/Role");

// Rol oluşturma
exports.createRole = async (req, res) => {
  try {
    const { roleName } = req.body;

    // Aynı isimde rol var mı?
    const existingRole = await Role.findOne({ roleName });
    if (existingRole) {
      return res.status(400).json({ success: false, message: "Bu rol zaten mevcut." });
    }

    const newRole = await Role.create({ roleName });
    res.status(201).json({ success: true, data: newRole });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Rol oluşturulamadı." });
  }
};

// Tüm rolleri listeleme
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find();
    res.status(200).json({ success: true, data: roles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Roller getirilemedi." });
  }
};

// Tekil rol görüntüleme
exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Rol bulunamadı." });
    }
    res.status(200).json({ success: true, data: role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Rol getirilemedi." });
  }
};

// Rol silme
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Rol bulunamadı." });
    }
    await role.deleteOne();
    res.status(200).json({ success: true, message: "Rol başarıyla silindi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Rol silinemedi." });
  }
};
