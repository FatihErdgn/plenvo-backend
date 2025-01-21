// middlewares/checkPermission.js
const Role = require("../models/Role");

const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      // req.user.role -> "doctor" veya "admin" vs
      const roleName = req.user.role; 
      const roleDoc = await Role.findOne({ name: roleName });
      if (!roleDoc) {
        return res.status(403).json({ message: "Rol tanımlı değil" });
      }

      // Rolün permissions dizisinde aranan permission var mı?
      if (!roleDoc.permissions.includes(permission)) {
        return res.status(403).json({ message: "Bu işlem için yetkiniz yok" });
      }

      // İzin var, devam et
      next();
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Sunucu hatası" });
    }
  };
};

module.exports = checkPermission;
