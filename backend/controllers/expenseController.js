const Expense = require("../models/Expense");
const Currency = require("../models/Currency");

/**
 * createExpense: Yeni bir gider oluşturur.
 *
 * Beklenen req.body alanları:
 * - expenseCategory, expenseDescription, expenseKind, expenseAmount, expenseDate, currencyId
 *
 * Token üzerinden alınan:
 * - customerId, clinicId, ve kullanıcı id'si (lastEditBy)
 */
exports.createExpense = async (req, res) => {
  try {
    const {
      expenseCategory,
      expenseDescription,
      expenseKind,
      expenseAmount,
      expenseDate,
      currencyName,
    } = req.body;

    // Gerekli alan kontrolü
    if (
      !expenseCategory ||
      !expenseDescription ||
      !expenseKind ||
      !expenseAmount ||
      !expenseDate ||
      !currencyName
    ) {
      return res.status(400).json({
        success: false,
        message: "Tüm alanlar zorunludur.",
      });
    }

    const foundCurrency = await Currency.findOne({ currencyName });
    if (!foundCurrency) {
      return res.status(400).json({
        success: false,
        message: `Geçersiz para birimi ismi: ${currencyName}`,
      });
    }

    // Tarih validasyonu
    const parsedDate = new Date(expenseDate);
    const isValidDate = parsedDate instanceof Date && !isNaN(parsedDate);

    if (!isValidDate) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz tarih formatı.",
      });
    }

    // Token'dan müşteri ve klinik bilgileri (authentication middleware req.user'ı doldurmalı)
    const customerId = req.user.customerId;
    const clinicId = req.user.clinicId;
    const lastEditBy = req.user.userId;
    const lastEditDate = new Date();
    console.log("lastEditBy", lastEditBy);
    console.log("customerId", customerId);

    const newExpense = new Expense({
      customerId,
      clinicId,
      currencyId: foundCurrency._id, // Modeldeki alan adı
      expenseCategory,
      expenseDescription,
      expenseKind,
      expenseAmount,
      expenseDate: parsedDate,
      isDeleted: false,
      lastEditBy,
      lastEditDate,
    });

    const savedExpense = await newExpense.save();
    return res.status(201).json({ success: true, expense: savedExpense });
  } catch (error) {
    console.error("Create Expense Error:", error);
    return res.status(500).json({
      success: false,
      message: "Gider oluşturulurken bir hata oluştu.",
    });
  }
};

/**
 * updateExpense: Varolan bir gideri günceller.
 *
 * req.params.id ile giderin id'si, req.body ile güncellenmek istenen alanlar gönderilir.
 * Tarih güncellemesi yapılırsa validasyon gerçekleştirilir.
 * lastEditBy ve lastEditDate token üzerinden güncellenir.
 */
exports.updateExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;
    const updateData = req.body;

    if (updateData.expenseDate) {
      const parsedDate = new Date(updateData.expenseDate);
      if (isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Geçersiz tarih formatı." });
      }
      updateData.expenseDate = parsedDate;
    }

    // Güncelleme sırasında son düzenleyen ve tarih bilgisi ayarlanır.
    updateData.lastEditBy = req.user.userId;
    updateData.lastEditDate = new Date();

    const updatedExpense = await Expense.findByIdAndUpdate(
      expenseId,
      updateData,
      { new: true }
    );
    if (!updatedExpense) {
      return res
        .status(404)
        .json({ success: false, message: "Gider bulunamadı." });
    }
    return res.status(200).json({ success: true, expense: updatedExpense });
  } catch (error) {
    console.error("Update Expense Error:", error);
    return res.status(500).json({
      success: false,
      message: "Gider güncellenirken bir hata oluştu.",
    });
  }
};

/**
 * softDeleteExpense: Gideri soft delete yapar (isDeleted = true).
 */
exports.softDeleteExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;
    const updateData = {
      isDeleted: true,
      lastEditBy: req.user._id,
      lastEditDate: new Date(),
    };

    const deletedExpense = await Expense.findByIdAndUpdate(
      expenseId,
      updateData,
      { new: true }
    );
    if (!deletedExpense) {
      return res
        .status(404)
        .json({ success: false, message: "Gider bulunamadı." });
    }
    return res.status(200).json({ success: true, expense: deletedExpense });
  } catch (error) {
    console.error("Soft Delete Expense Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Gider silinirken bir hata oluştu." });
  }
};

/**
 * getExpenses: İlgili müşteriye ait giderleri, en güncelden en eskiye sıralı ve sayfalama (pagination) ile getirir.
 */
exports.getExpenses = async (req, res) => {
  try {
    // Token üzerinden gelen customerId bilgisi
    const customerId = req.user.customerId;

    // Eğer customerId varsa ilgili kullanıcının verilerini getir, yoksa tüm verileri getir
    const query = customerId ? { customerId, isDeleted: false } : { isDeleted: false };

    const expenses = await Expense.find(query)
      .populate({
        path: "currencyId",
        select: "currencyName -_id", // Sadece "currencyName" alanını getir, "_id"yi getirme
      })
      .sort({ expenseDate: -1 }) // En güncelden en eskiye sıralama
      .lean();

    // currencyId nesne olarak dönecek, sadece currencyName almamız lazım
    const transformedExpenses = expenses.map(expense => ({
      ...expense,
      currencyName: expense.currencyId.currencyName, // currencyName'i ekliyoruz
    }));

    return res.status(200).json({
      success: true,
      expense: transformedExpenses, // Güncellenmiş veriyi gönderiyoruz
    });
  } catch (error) {
    console.error("Get Expenses Error:", error);
    return res.status(500).json({
      success: false,
      message: "Giderler alınırken bir hata oluştu.",
    });
  }
};



