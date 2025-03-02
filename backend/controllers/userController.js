const User = require("../models/User");
const Role = require("../models/Role");
const Clinic = require("../models/Clinic");
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
      clinic,
      hireDate,
      // clinicId,
      // customerId,
      password, // Şifre front-end'den geliyor
      roleName, // Front-end'den sadece roleName gelecek (doctor, manager vs.)
    } = req.body;

    const existingUser = await User.findOne({
      isDeleted: false,
      $or: [{ username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          "Kullanıcı adı, e-posta veya telefon numarası zaten kullanılıyor.",
      });
    }

    if (!roleName) {
      return res
        .status(400)
        .json({ success: false, message: "roleName değeri zorunludur." });
    }
    const lowerCaseRoleName = roleName.toLowerCase();

    // Önce roleName'e göre Role dökümanını bulalım
    const foundRole = await Role.findOne({ roleName: lowerCaseRoleName });
    if (!foundRole) {
      return res.status(400).json({
        success: false,
        message: `Geçersiz rol ismi: ${lowerCaseRoleName}`,
      });
    }

    // Tarih validasyonu
    let parsedDate = null;
    if (hireDate) {
      parsedDate = new Date(hireDate);
      const isValidDate = parsedDate instanceof Date && !isNaN(parsedDate);

      if (!isValidDate) {
        return res.status(400).json({
          success: false,
          message: "Geçersiz tarih formatı.",
        });
      }
    }

    // Şifre zorluk kontrolü
    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Şifre en az 8 karakter, bir büyük harf, bir küçük harf, bir sayı ve bir özel karakter içermelidir.",
      });
    }

    const newClinic = new Clinic({
      customerId: req.user.customerId,
      clinicName: clinic,
    });
    await newClinic.save();
    // Token'dan müşteri ve klinik bilgileri (authentication middleware req.user'ı doldurmalı)
    const customerId = req.user.customerId;

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
      clinicId: newClinic._id,
      customerId,
      password,
      roleId: foundRole._id,
    });

    if (parsedDate) {
      newUser.hireDate = parsedDate;
    }

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

exports.updateUser = async (req, res) => {
  try {
    const { role } = req.user; // JWT'den gelen kullanıcı rolü
    // Sadece admin ve superadmin güncelleyebilsin
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Yetkiniz yok." });
    }

    const { id } = req.params; // Düzenlenecek kullanıcı ID'si
    const updatedData = { ...req.body };

    // 1) Eğer roleName gönderildiyse, Role koleksiyonundan bulup roleId'yi güncelleyelim
    if (updatedData.roleName) {
      // Tutarlılık için roleName'i küçük harfe çeviriyoruz (veritabanında da böyle saklanıyorsa)
      const lowerCaseRoleName = updatedData.roleName.toLowerCase();
      const foundRole = await Role.findOne({ roleName: lowerCaseRoleName });
      if (!foundRole) {
        return res.status(400).json({
          success: false,
          message: `Geçersiz rol ismi: ${updatedData.roleName}`,
        });
      }
      updatedData.roleId = foundRole._id;
      delete updatedData.roleName; // Şemada roleName yok, sadece roleId saklıyoruz
    }

    // 2) Eğer clinicName gönderildiyse, Clinic koleksiyonundan bulup clinicId'yi güncelleyelim
    if (updatedData.clinicName) {
      const foundClinic = await Clinic.findOne({
        clinicName: updatedData.clinicName,
      });
      if (!foundClinic) {
        return res.status(400).json({
          success: false,
          message: `Geçersiz klinik ismi: ${updatedData.clinicName}`,
        });
      }
      updatedData.clinicId = foundClinic._id;
      delete updatedData.clinicName;
    }

    // 3) Kullanıcıyı bulalım
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    // 4) Güncellenmesi gereken alanları user nesnesine kopyala
    Object.assign(user, updatedData);

    // 5) Şifre güncellenecekse pre('save') hook'u hash işlemini yapacak
    await user.save();

    // 6) Başarılı yanıt
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
// Kullanıcıları listeleme
exports.getUsers = async (req, res) => {
  try {
    const customerId = req.user.customerId; // JWT'den gelen customerId

    const query = customerId
      ? { customerId, isDeleted: false }
      : { isDeleted: false };

    // Tüm aktif (isDeleted=false) kullanıcılar. roleId populate edince roleName görünür.
    const users = await User.find(query)
      .populate({
        path: "roleId",
        select: "roleName",
      })
      .populate({
        path: "clinicId",
        select: "clinicName",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Superadmin kullanıcılarını filtrele
    const filteredUsers = users.filter(
      (user) => user.roleId?.roleName !== "superadmin"
    );

    // Kullanıcıları dönüştür (roleName ve clinicName ekleyerek)
    const transformedUsers = filteredUsers.map((user) => ({
      ...user, // ❌ Yanlış: filteredUsers yerine user kullanmalıyız
      roleName: user.roleId?.roleName,
      clinicName: user.clinicId?.clinicName,
      speciality: user.speciality,
    }));
    // console.log(transformedUsers);

    res.status(200).json({ success: true, data: transformedUsers });
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
        message: "Yeni şifreniz gönderildi.",
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
      message:
        "Şifre sıfırlama için kayıtlı telefon numaranız veya email adresiniz bulunamadı.",
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
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    // Başarılı => kullanıcıyı dön
    // (JSON içinde user bilgilerini gönderiyoruz, hassas alanları temizlemek isterseniz seçebilirsiniz)
    return res.json({ success: true, user });
  } catch (error) {
    console.error("Profil getirme hatası:", error);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
};
