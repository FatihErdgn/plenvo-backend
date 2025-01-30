const User = require("../models/User");
const Role = require("../models/Role");
const bcrypt = require("bcryptjs");
const { isValidPassword } = require("../utils/passwordValidation");
const { generateRandomPassword } = require("../utils/passwordGenerator");
const sendSMS = require("../utils/smsService");

// Kullanıcı oluşturma
exports.createUser = async (req, res) => {
  try {
    // Sadece admin ve superadmin bu işlemi yapabilir
    const { role } = req.user; // JWT'den gelen role
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const {
      username,
      userMail,
      firstName,
      lastName,
      profession,
      speciality,
      salary,
      phoneNumber,
      hireDate,
      clinicId,
      customerId,
      password, // Şifre front-end'den geliyor
      roleName, // Front-end'den sadece roleName gelecek (doctor, manager vs.)
    } = req.body;

    // Önce roleName'e göre Role dökümanını bulalım
    const foundRole = await Role.findOne({ roleName });
    if (!foundRole) {
      return res.status(400).json({
        success: false,
        message: `Geçersiz rol ismi: ${roleName}`,
      });
    }

    // Şifre zorluk kontrolü
    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Şifre en az 8 karakter, bir büyük harf, bir küçük harf, bir sayı ve bir özel karakter içermelidir.",
      });
    }

    // Yeni kullanıcı oluştur
    const newUser = new User({
      username,
      userMail,
      firstName,
      lastName,
      profession,
      speciality,
      salary,
      phoneNumber,
      hireDate,
      clinicId,
      customerId,
      password,
      roleId: foundRole._id, // Sadece roleId saklıyoruz
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: "Kullanıcı başarıyla oluşturuldu.",
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Kullanıcı oluşturulamadı." });
  }
};

// Kullanıcı bilgilerini düzenleme
exports.updateUser = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const { id } = req.params; // Düzenlenecek kullanıcı ID'si
    const updatedData = { ...req.body };

    // Eğer front-end yeni bir roleName gönderiyorsa, o roleName'e göre roleId bulmamız lazım
    if (updatedData.roleName) {
      const foundRole = await Role.findOne({ roleName: updatedData.roleName });
      if (!foundRole) {
        return res.status(400).json({
          success: false,
          message: `Geçersiz rol ismi: ${updatedData.roleName}`,
        });
      }
      // roleId'yi güncelle
      updatedData.roleId = foundRole._id;
      // user schema'da roleName alanı yok, bu yüzden object'ten silebiliriz
      delete updatedData.roleName;
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    // updatedData içindeki alanları user nesnesine kopyala
    Object.assign(user, updatedData);

    // Şifre güncelleniyorsa, pre('save') hook tetiklenecek ve hashlenecek
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Kullanıcı başarıyla güncellendi." });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Kullanıcı güncellenemedi." });
  }
};

// Kullanıcı silme (soft delete)
exports.deleteUser = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const { id } = req.params; // Silinecek kullanıcı ID'si
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    user.isDeleted = true;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Kullanıcı başarıyla silindi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Kullanıcı silinemedi." });
  }
};

// Kullanıcıları listeleme
exports.getUsers = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "admin" && role !== "superadmin" && role !== "manager") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    // Tüm aktif (isDeleted=false) kullanıcılar. roleId populate edince roleName görünür.
    const users = await User.find({ isDeleted: false }).populate("roleId");
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Kullanıcılar getirilemedi." });
  }
};

// Kullanıcı şifre değiştirme
exports.changePassword = async (req, res) => {
  try {
    const { userId } = req.user; // JWT'den userId al
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    // Mevcut şifre doğrulama
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Mevcut şifre hatalı." });
    }

    // Yeni şifre zorluk kontrolü
    if (!isValidPassword(newPassword)) {
      console.log(newPassword);
      return res.status(400).json({
        success: false,
        message:
          "Şifre en az 8 karakter, bir büyük harf, bir küçük harf, bir sayı ve bir özel karakter içermelidir.",
      });
    }

    // Şifre güncelleme (direkt set et, pre-save hook hash'leyecek)
    user.password = newPassword;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Şifre başarıyla değiştirildi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Şifre değiştirilemedi." });
  }
};

// Şifremi Unuttum
exports.forgotPassword = async (req, res) => {
  try {
    const { phoneNumber, userMail } = req.body;

    // En az birinin gönderildiğini kontrol et
    if (!phoneNumber && !userMail) {
      return res.status(400).json({
        success: false,
        message: "Telefon numarası veya e-posta adresi gereklidir",
      });
    }

    // Kullanıcıyı bul (soft delete olmayanlar)
    const user = await User.findOne({
      $or: [{ phoneNumber }, { userMail }],
      isDeleted: false,
    });

    // Kullanıcıyı bulamasak bile genel mesaj ver (güvenlik için)
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "Yeni şifreniz gönderildi.",
      });
    }

    // Rastgele şifre oluştur
    const newPassword = generateRandomPassword();

    // Şifreyi güncelle
    user.password = newPassword;
    await user.save(); // pre-save hook ile hash'lenecek

    // SMS gönder (telefon numarası varsa)
    if (user.phoneNumber) {
      const messageText = `Yeni şifreniz: ${newPassword}`;
      await sendSMS([user.phoneNumber], messageText);
      
      return res.status(200).json({
        success: true,
        message: "Yeni şifreniz SMS ile gönderildi.",
      });
    }

    // TODO: E-posta gönderim desteği eklenecek
    return res.status(400).json({
      success: false,
      message: "Şifre sıfırlama için kayıtlı telefon numaranız veya email adresiniz bulunamadı.",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Şifre sıfırlama işlemi sırasında bir hata oluştu.",
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    // authMiddleware'de "req.user = decoded" demiştik.
    // orada { userId, role, ... } doldurulur
    const { userId } = req.user;

    // Veritabanında kullanıcıyı bul
    // .populate("roleId") => user.roleId nesnesi hakkında tüm dokümanı da getirir.
    const user = await User.findById(userId).populate("roleId");

    // Kullanıcı yoksa veya soft-deleted ise
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    // Başarılı => kullanıcıyı dön
    // (JSON içinde user bilgilerini gönderiyoruz, hassas alanları temizlemek isterseniz seçebilirsiniz)
    return res.json({ success: true, user });
  } catch (error) {
    console.error("Profil getirme hatası:", error);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
};