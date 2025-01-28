// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1) Subdomain'den çektiğimiz customer
    const customer = req.customer; // resolveCustomer middleware'den geliyor

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Müşteri bulunamadı" });
    }

    // 2) Kullanıcıyı bul (username ve isDeleted: false)
    // Populate ile roleId'yi çekip rol ismini sorgulayacağız
    const user = await User.findOne({ username, isDeleted: false }).populate("roleId");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    // Şifre kontrolü
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Şifre hatalı." });
    }

    // 3) Kullanıcının rolü süperadmin mi?
    const isSuperadmin = user.roleId?.roleName === "superadmin";

    // 4) Eğer süperadmin değilse, user.customerId bu subdomain'e ait mi?
    //    Eşleşmezse 403 ya da 404 dönebilirsiniz. Burada 404 verelim.
    if (!isSuperadmin) {
      if (!user.customerId || user.customerId.toString() !== customer._id.toString()) {
        return res.status(404).json({
          success: false,
          message: "Bu müşteri için kullanıcı bulunamadı.",
        });
      }
    }

    // 5) JWT payload
    const tokenPayload = {
      userId: user._id,
      role: user.roleId?.roleName, 
      clinicId: user.clinicId,
      // Süperadmin ise customerId null (sınırsız erişim)
      // Değilse kendi customerId'si
      customerId: isSuperadmin ? null : user.customerId,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "3h",
    });

    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Bir hata oluştu." });
  }
};
