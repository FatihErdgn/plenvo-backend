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
    const user = await User.findOne({ username, isDeleted: false }).populate(
      "roleId"
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    // Şifre kontrolü
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Şifre hatalı." });
    }

    // 3) Kullanıcının rolü süperadmin mi?
    const isSuperadmin = user.roleId?.roleName === "superadmin";

    // 4) Eğer süperadmin değilse, user.customerId bu subdomain'e ait mi?
    //    Eşleşmezse 403 ya da 404 dönebilirsiniz. Burada 404 verelim.
    if (!isSuperadmin) {
      if (
        !user.customerId ||
        user.customerId.toString() !== customer._id.toString()
      ) {
        return res.status(404).json({
          success: false,
          message: "Bu müşteri için kullanıcı bulunamadı.",
        });
      }
    }

    // 5) JWT payload
    const tokenPayload = {
      userId: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      userMail: user.userMail,
      role: user.roleId?.roleName,
      clinicId: user.clinicId,
      // Süperadmin ise customerId null (sınırsız erişim)
      // Değilse kendi customerId'si
      customerId: user.customerId,
    };

    // 4) JWT oluştur
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "3h", // Token 3 saat sonra da geçersiz olacak
    });

    // 5) Cookie olarak token'ı set et (session cookie => maxAge yok)
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      // Eğer tarayıcı kapandığında silinmesini istiyorsan maxAge veya expires koyma.
      // eğer hem session hem 3h istersen => user 3h open tab => still valid
    });

    return res.json({ success: true, message: "Login başarılı", token });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Bir hata oluştu." });
  }
};

// controllers/authController.js
exports.logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return res.status(200).json({ success: true, message: "Çıkış başarılı." });
  } catch (error) {
    console.error("Logout hatası:", error);
    res
      .status(500)
      .json({ success: false, message: "Çıkış işlemi başarısız oldu." });
  }
};
