const Payment = require("../models/Payment");
const Expense = require("../models/Expense");
const Appointment = require("../models/Appointment");

/**
 * GET /api/dashboard
 * Örnek: GET /api/dashboard?startDate=2025-02-01&endDate=2025-02-09
 *
 * Veriler günlük bazda toplanır. "change" değeri, son gün ile ondan önceki gün arasındaki fark yüzdesi olarak hesaplanır.
 */
exports.getDashboardData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ status: "error", message: "startDate ve endDate gereklidir." });
    }

    // Auth middleware'den gelen customerId (örn: JWT'den)
    const customerId = req.user.customerId;
    if (!customerId) {
      return res.status(400).json({ status: "error", message: "customerId bulunamadı." });
    }

    // 1) Tarihleri parse et
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 2) Günlük gruplama için tarih formatı
    const dateFormat = "%Y-%m-%d";

    // --- SUMMARY ---
    // Gelir (Payment)
    const incomeResult = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: start, $lte: end },
          paymentStatus: "Tamamlandı",
          isDeleted: false,
          customerId, // Müşteri filtresi eklendi
        },
      },
      {
        $group: { _id: null, totalIncome: { $sum: "$serviceFee" } },
      },
    ]);
    const totalIncome = incomeResult[0]?.totalIncome || 0;

    // Gider (Expense)
    const expenseResult = await Expense.aggregate([
      {
        $match: {
          expenseDate: { $gte: start, $lte: end },
          isDeleted: false,
          customerId, // Müşteri filtresi eklendi
        },
      },
      {
        $group: { _id: null, totalExpense: { $sum: "$expenseAmount" } },
      },
    ]);
    const totalExpense = expenseResult[0]?.totalExpense || 0;

    // Kâr
    const profit = totalIncome - totalExpense;

    // Hasta sayısı (Appointment)
    const patientResult = await Appointment.aggregate([
      {
        $match: {
          datetime: { $gte: start, $lte: end },
          isDeleted: false,
          customerId, // Müşteri filtresi eklendi
        },
      },
      { $count: "totalPatients" },
    ]);
    const totalPatientCount = patientResult[0]?.totalPatients || 0;

    // --- TREND (Günlük) ---
    // Gelir Trend
    const incomeTrendAgg = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: start, $lte: end },
          paymentStatus: "Tamamlandı",
          isDeleted: false,
          customerId, // Müşteri filtresi eklendi
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: dateFormat, date: "$paymentDate" },
            },
          },
          dailyIncome: { $sum: "$serviceFee" },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Gider Trend
    const expenseTrendAgg = await Expense.aggregate([
      {
        $match: {
          expenseDate: { $gte: start, $lte: end },
          isDeleted: false,
          customerId, // Müşteri filtresi eklendi
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: dateFormat, date: "$expenseDate" },
            },
          },
          dailyExpense: { $sum: "$expenseAmount" },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Hasta Trend
    const patientTrendAgg = await Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: start, $lte: end },
          isDeleted: false,
          customerId, // Müşteri filtresi eklendi
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: dateFormat, date: "$appointmentDate" },
            },
          },
          dailyPatients: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Tüm tarihleri oluştur (start'dan end'e kadar)
    const dateArray = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dateArray.push(new Date(d).toISOString().split("T")[0]);
    }

    // Aggregation sonuçlarını haritaya dönüştürelim:
    const incomeMap = {};
    incomeTrendAgg.forEach(doc => { incomeMap[doc._id.date] = doc.dailyIncome; });
    const expenseMap = {};
    expenseTrendAgg.forEach(doc => { expenseMap[doc._id.date] = doc.dailyExpense; });
    const patientMap = {};
    patientTrendAgg.forEach(doc => { patientMap[doc._id.date] = doc.dailyPatients; });

    // Trend dizilerini oluştur:
    const trendIncome = [];
    const trendExpense = [];
    const trendProfit = [];
    const trendPatients = [];
    dateArray.forEach(date => {
      const inc = incomeMap[date] || 0;
      const exp = expenseMap[date] || 0;
      const pat = patientMap[date] || 0;
      trendIncome.push(inc);
      trendExpense.push(exp);
      trendProfit.push(inc - exp);
      trendPatients.push(pat);
    });

    // Change hesaplaması: son gün ile ondan önceki gün arasındaki fark yüzdesi
    const computeChange = (arr) => {
      if (arr.length < 2 || arr[arr.length - 2] === 0) return null;
      const last = arr[arr.length - 1];
      const prev = arr[arr.length - 2];
      return ((last - prev) / prev) * 100;
    };
    const incomeChange = computeChange(trendIncome);
    const expenseChange = computeChange(trendExpense);
    const profitChange = computeChange(trendProfit);
    const patientChange = computeChange(trendPatients);

    // --- BREAKDOWN ---
    // Gelir Breakdown: ödeme yöntemlerine göre
    const incomeBreakdownAgg = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: start, $lte: end },
          paymentStatus: "Tamamlandı",
          isDeleted: false,
          customerId, // Müşteri filtresi eklendi
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          amount: { $sum: "$serviceFee" },
        },
      },
      { $sort: { amount: -1 } },
    ]);
    const incomeMethods = incomeBreakdownAgg.map(doc => ({
      method: doc._id,
      amount: doc.amount,
    }));

    // Gider Breakdown: gider açıklamalarına göre
    const expenseBreakdownAgg = await Expense.aggregate([
      {
        $match: {
          expenseDate: { $gte: start, $lte: end },
          isDeleted: false,
          customerId, // Müşteri filtresi eklendi
        },
      },
      {
        $group: {
          _id: "$expenseDescription",
          amount: { $sum: "$expenseAmount" },
        },
      },
      { $sort: { amount: -1 } },
    ]);
    const expenseDescriptions = expenseBreakdownAgg.map(doc => ({
      description: doc._id,
      amount: doc.amount,
    }));

    // Yanıtı oluştur
    return res.json({
      status: "success",
      updatedAt: new Date().toISOString(),
      data: {
        summary: {
          totalIncome,
          totalExpense,
          profit,
          patientCount: totalPatientCount,
        },
        trend: {
          dates: dateArray,
          income: trendIncome,
          expense: trendExpense,
          profit: trendProfit,
          patientCount: trendPatients,
          change: {
            income: incomeChange,
            expense: expenseChange,
            profit: profitChange,
            patientCount: patientChange,
          },
        },
        breakdown: {
          incomeMethods,
          expenseDescriptions,
        },
      },
    });
  } catch (err) {
    console.error("Error in getDashboardData:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};
