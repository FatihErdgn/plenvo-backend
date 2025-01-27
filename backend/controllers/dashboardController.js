// controllers/dashboardController.js

const Payment = require("../models/Payment");
const Expense = require("../models/Expense");
const Appointment = require("../models/Appointment"); // Appointment modelini ekleyin
// Diğer modelleri de import edebilirsiniz

/**
 * GET /api/dashboard
 * Örnek: GET /api/dashboard?startDate=2025-01-01&endDate=2025-01-31&interval=weekly
 * 
 * Parametreler:
 * - startDate, endDate: Aranacak tarih aralığı (string)
 * - interval: "daily", "weekly", "monthly", "yearly" vb. (tarih formatını belirliyor)
 */
exports.getDashboardData = async (req, res) => {
  try {
    const { startDate, endDate, interval } = req.query;

    // 1) start ve end'i Date olarak parse et
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 2) interval'e göre dateFormat seç
    // daily => YYYY-MM-DD, weekly => YYYY-Wxx, monthly => YYYY-MM, yearly => YYYY
    let dateFormat = "%Y-%m-%d"; // günlük baz
    if (interval === "weekly") {
      dateFormat = "%G-W%V"; // ISO Year-Week
    } else if (interval === "monthly") {
      dateFormat = "%Y-%m"; // Yıl-Ay
    } else if (interval === "yearly") {
      dateFormat = "%Y"; // Sadece Yıl
    }

    // 3) Önceki dönem için tarihleri hesapla
    let prevStart, prevEnd;

    if (interval === "daily") {
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 1);
    } else if (interval === "weekly") {
      // Haftalık, 7 gün geri
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 7);
    } else if (interval === "monthly") {
      // Aylık, 1 ay geri
      prevStart = new Date(start);
      prevStart.setMonth(prevStart.getMonth() - 1);
      prevEnd = new Date(end);
      prevEnd.setMonth(prevEnd.getMonth() - 1);
    } else if (interval === "yearly") {
      // Yıllık, 1 yıl geri
      prevStart = new Date(start);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      prevEnd = new Date(end);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);
    } else {
      // Geçersiz interval
      return res.status(400).json({ status: "error", message: "Invalid interval" });
    }

    // 4) Payment Aggregation (Income) - Mevcut dönem
    const paymentMatch = {
      paymentDate: { $gte: start, $lte: end },
      paymentStatus: { $in: ["Completed", "Paid", "Ödendi", "Success"] },
    };

    const incomeTrendAgg = await Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: {
            dateGroup: {
              $dateToString: { format: dateFormat, date: "$paymentDate" },
            },
          },
          totalFee: { $sum: "$serviceFee" }, // $serviceFee kullanıyoruz
          descArray: { $push: "$paymentDescription" }, // description'ları listeleyelim
        },
      },
      { $sort: { "_id.dateGroup": 1 } }, // Tarih sırası
    ]);

    const incomeLabels = incomeTrendAgg.map((doc) => doc._id.dateGroup);
    const incomeValues = incomeTrendAgg.map((doc) => doc.totalFee);
    const incomeDescs = incomeTrendAgg.map((doc) => doc.descArray); 
    // Örneğin [ ["Ödeme A", "Ödeme B"], ["Ödeme C"], ... ]

    const totalIncome = incomeValues.reduce((acc, val) => acc + val, 0);

    // 5) Expense Aggregation (Expense) - Mevcut dönem
    const expenseMatch = {
      expenseDate: { $gte: start, $lte: end },
    };

    const expenseTrendAgg = await Expense.aggregate([
      { $match: expenseMatch },
      {
        $group: {
          _id: {
            dateGroup: {
              $dateToString: { format: dateFormat, date: "$expenseDate" },
            },
          },
          totalExpense: { $sum: "$expenseAmount" },
          descArray: { $push: "$expenseDescription" }, // gider açıklamaları
        },
      },
      { $sort: { "_id.dateGroup": 1 } },
    ]);

    const expenseLabels = expenseTrendAgg.map((doc) => doc._id.dateGroup);
    const expenseValues = expenseTrendAgg.map((doc) => doc.totalExpense);
    const expenseDescs = expenseTrendAgg.map((doc) => doc.descArray);
    const totalExpense = expenseValues.reduce((acc, val) => acc + val, 0);

    // 6) Önceki dönem gelir ve gider aggregasyonu
    // 6-A) Önceki dönem Payment Aggregation (Income)
    const prevPaymentMatch = {
      paymentDate: { $gte: prevStart, $lte: prevEnd },
      paymentStatus: { $in: ["Completed", "Paid", "Ödendi", "Success"] },
    };

    const prevIncomeTrendAgg = await Payment.aggregate([
      { $match: prevPaymentMatch },
      {
        $group: {
          _id: {
            dateGroup: {
              $dateToString: { format: dateFormat, date: "$paymentDate" },
            },
          },
          totalFee: { $sum: "$serviceFee" },
        },
      },
      { $sort: { "_id.dateGroup": 1 } },
    ]);

    const prevTotalIncome = prevIncomeTrendAgg.reduce((acc, doc) => acc + doc.totalFee, 0);

    // 6-B) Önceki dönem Expense Aggregation (Expense)
    const prevExpenseMatch = {
      expenseDate: { $gte: prevStart, $lte: prevEnd },
    };

    const prevExpenseTrendAgg = await Expense.aggregate([
      { $match: prevExpenseMatch },
      {
        $group: {
          _id: {
            dateGroup: {
              $dateToString: { format: dateFormat, date: "$expenseDate" },
            },
          },
          totalExpense: { $sum: "$expenseAmount" },
        },
      },
      { $sort: { "_id.dateGroup": 1 } },
    ]);

    const prevTotalExpense = prevExpenseTrendAgg.reduce((acc, doc) => acc + doc.totalExpense, 0);

    // 7) Profitability Aggregation (Mevcut dönem)
    // Profitability = totalIncome - totalExpense
    const totalProfitability = totalIncome - totalExpense;

    // 8) Önceki dönemdeki Profitability
    const prevTotalProfitability = prevTotalIncome - prevTotalExpense;

    // 9) Profitability Change Yüzdesi
    const profitabilityChange = prevTotalProfitability === 0 ? null : ((totalProfitability - prevTotalProfitability) / prevTotalProfitability) * 100;

    // 10) Patient Count Aggregation (Mevcut dönem)
    const patientMatch = {
      appointmentDate: { $gte: start, $lte: end },
    };

    const patientCountAgg = await Appointment.aggregate([
      { $match: patientMatch },
      { $count: "totalCount" },
    ]);

    const totalPatientCount = patientCountAgg[0]?.totalCount || 0;

    // 11) Önceki dönemdeki Patient Count Aggregation
    const prevPatientMatch = {
      appointmentDate: { $gte: prevStart, $lte: prevEnd },
    };

    const prevPatientCountAgg = await Appointment.aggregate([
      { $match: prevPatientMatch },
      { $count: "totalCount" },
    ]);

    const prevTotalPatientCount = prevPatientCountAgg[0]?.totalCount || 0;

    // 12) Patient Count Change Yüzdesi
    const patientCountChange = prevTotalPatientCount === 0 ? null : ((totalPatientCount - prevTotalPatientCount) / prevTotalPatientCount) * 100;

    // 13) Değişim yüzdeleri hesaplama
    const incomeChange = prevTotalIncome === 0 ? null : ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100;
    const expenseChange = prevTotalExpense === 0 ? null : ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100;

    // 14) JSON Response
    return res.json({
      status: "success",
      updatedAt: new Date().toISOString(),
      data: {
        [interval]: {
          startDate: start,
          endDate: end,
          totalIncome: {
            value: totalIncome,      
            trend: incomeValues,         // toplam rakamlar
            trendDates: incomeLabels,    // tarih string'leri
            trendDesc: incomeDescs,      // her tarihteki ödeme description listesi
            change: incomeChange,        // % değişim
          },
          totalExpense: {
            value: totalExpense,
            trend: expenseValues,
            trendDates: expenseLabels,
            trendDesc: expenseDescs,     // her tarihteki gider description listesi
            change: expenseChange,       // % değişim
          },
          profitability: {
            value: totalProfitability,
            trend: incomeValues.map((income, idx) => income - (expenseValues[idx] || 0)),
            trendDates: incomeLabels, // Aynı kategorileri kullanıyoruz
            change: profitabilityChange, // % değişim
          },
          patientCount: {
            value: totalPatientCount,
            trend: [], // Eğer trend hesaplanacaksa, farklı aggregasyonlar ekleyebilirsiniz
            trendDates: incomeLabels, // Aynı kategorileri kullanıyoruz
            change: patientCountChange, // % değişim
          },
        },
      },
    });
  } catch (err) {
    console.error("Error in getDashboardData:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};
