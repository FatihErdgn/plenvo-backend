// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1) Kullanıcıyı bul
    const user = await User.findOne({ username, isDeleted: false }).populate("roleId");
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    }
    console.log(user);
    // 2) Şifre doğrulama (şemadaki matchPassword metodunu çağırıyoruz)
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Şifre hatalı." });
      
    }
    

    // 3) JWT oluştur
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.roleId.roleName, // "admin", "manager", "doctor", vs.
        customerId: user.customerId, // Kullanıcının bağlı olduğu müşteri
        clinicId: user.clinicId,     // Kullanıcının bağlı olduğu klinik
      },
      process.env.JWT_SECRET,
      { expiresIn: "3h" }
    );

    // 4) Yanıt
    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Bir hata oluştu." });
  }
};
