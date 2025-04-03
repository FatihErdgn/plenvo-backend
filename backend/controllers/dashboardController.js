const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Expense = require("../models/Expense");
const Appointment = require("../models/Appointment");
const CalendarAppointment = require("../models/CalendarAppointment");

/**
 * GET /api/dashboard
 * Örnek: GET /api/dashboard?startDate=2025-02-01&endDate=2025-02-09[&doctorId=...]
 *
 * Not:
 * - Eğer giriş yapan kullanıcı "doctor" ise:
 *    - Sadece kendi verileri gösterilir (Payment, Appointment için filtre uygulanır).
 *    - Payment değerleri, paymentAmount üzerinden %40 ile hesaplanır.
 *    - Expense verisi 0, dolayısıyla profit = totalIncome olarak gönderilir.
 *
 * - Eğer giriş yapan kullanıcı admin/superadmin/manager ise:
 *    - Eğer doctorId query parametresi varsa, o doktorun verileri alınır:
 *         * Payment ve Appointment için filtre uygulanır.
 *         * Bu durumda Expense değeri 0 olarak kabul edilir ve
 *           Kar (profit) toplam gelirin %40'ı olarak hesaplanır.
 *    - Eğer doctorId parametresi yoksa, tüm veriler normal şekilde (Payment, Expense, profit) getirilir.
 */
exports.getDashboardData = async (req, res) => {
  try {
    const { startDate, endDate, doctorId } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ status: "error", message: "startDate ve endDate gereklidir." });
    }

    // JWT'den gelen customerId'yi ObjectId'ye çeviriyoruz.
    const customerId = new mongoose.Types.ObjectId(req.user.customerId);
    if (!customerId) {
      return res
        .status(400)
        .json({ status: "error", message: "customerId bulunamadı." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateFormat = "%Y-%m-%d";

    // Giriş yapan kullanıcının rolü ve ID'si
    // loggedInRole: "doctor", "admin", "manager", "superadmin"
    const loggedInRole = req.user.role;
    // Doktor rolündeyken, ID dönüşümü önemli (örneğin ObjectId'ye çevirme)
    const loggedInUserId = new mongoose.Types.ObjectId(
      req.user.userId || req.user._id
    );

    // Admin/superadmin/manager ise ve doctorId parametresi varsa, doktor filtresi uygulanacak.
    const isDoctorFilter =
      ["admin", "superadmin", "manager"].includes(loggedInRole) && doctorId;

    /* PAYMENT AGGREGATION */
    let paymentMatch = {
      paymentDate: { $gte: start, $lte: end },
      paymentStatus: { $in: ["Tamamlandı", "Ödeme Bekleniyor"] },
      isDeleted: false,
      customerId,
    };
    if (loggedInRole === "doctor") {
      paymentMatch.userId = loggedInUserId;
    } else if (isDoctorFilter) {
      paymentMatch.userId = new mongoose.Types.ObjectId(doctorId);
    }
    // Payment aggregation: Eğer loggedInRole doctor ise %40 ile çarp, aksi halde normal toplam.
    const incomeResult = await Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum:
              loggedInRole === "doctor"
                ? { $multiply: ["$paymentAmount", 0.4] }
                : "$paymentAmount",
          },
        },
      },
    ]);
    const totalIncome = incomeResult[0]?.totalIncome || 0;

    /* EXPENSE AGGREGATION */
    // Eğer kullanıcı doctor veya doktor filtresi uygulanmışsa gider 0 kabul edilecek.
    let totalExpense = 0;
    let expenseTrendAgg = [];
    let expenseBreakdownAgg = [];
    if (loggedInRole !== "doctor" && !isDoctorFilter) {
      const expenseMatch = {
        expenseDate: { $gte: start, $lte: end },
        isDeleted: false,
        customerId,
      };

      const expenseRes = await Expense.aggregate([
        { $match: expenseMatch },
        { $group: { _id: null, totalExpense: { $sum: "$expenseAmount" } } },
      ]);
      totalExpense = expenseRes[0]?.totalExpense || 0;

      expenseTrendAgg = await Expense.aggregate([
        { $match: expenseMatch },
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

      expenseBreakdownAgg = await Expense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: "$expenseDescription",
            amount: { $sum: "$expenseAmount" },
          },
        },
        { $sort: { amount: -1 } },
      ]);
    }
    // (Yani: doctor rolündeyse veya doktor filtresi varsa, gider sıfır.)

    /* APPOINTMENT AGGREGATION (Hasta sayısı ve trend) */
    let appointmentMatch = {
      datetime: { $gte: start, $lte: end },
      isDeleted: false,
      customerId,
    };

    // CalendarAppointment aggregation
    let calendarPatientMatch = {
      customerId,
      bookingId: { $exists: true },
      appointmentDate: { $gte: start, $lte: end },
    };

    if (loggedInRole === "doctor") {
      appointmentMatch.doctorId = loggedInUserId;
      calendarPatientMatch.doctorId = loggedInUserId;
    } else if (isDoctorFilter) {
      appointmentMatch.doctorId = new mongoose.Types.ObjectId(doctorId);
      calendarPatientMatch.doctorId = new mongoose.Types.ObjectId(doctorId);
    }
    const patientResult = await Appointment.aggregate([
      { $match: appointmentMatch },
      { $count: "totalPatients" },
    ]);

    const calendarPatientResult = await CalendarAppointment.aggregate([
      { $match: calendarPatientMatch },
      {
        $group: {
          _id: "$bookingId",
          participants: { $first: "$participants" }, // Aynı bookingId'li kayıtlar için diziyi alıyoruz
        },
      },
      {
        $project: {
          participantCount: { $size: "$participants" }, // Dizideki eleman sayısı
        },
      },
      {
        $group: {
          _id: null,
          totalPatients: { $sum: "$participantCount" }, // Tüm bookingId'ler için toplam katılımcı sayısı
        },
      },
    ]);

    // console.log("calendarPatientResult", calendarPatientResult);

    const totalPatientCount =
      (patientResult[0]?.totalPatients || 0) +
      (calendarPatientResult[0]?.totalPatients || 0);

    // console.log("totalPatientCount", totalPatientCount);

    /* TREND AGGREGATIONS */
    // Payment trend aggregation
    const incomeTrendAgg = await Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: dateFormat, date: "$paymentDate" },
            },
          },
          dailyIncome: {
            $sum:
              loggedInRole === "doctor"
                ? { $multiply: ["$paymentAmount", 0.4] }
                : "$paymentAmount",
          },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Expense trend: Eğer doctor veya doktor filtresi varsa, tüm tarihlerde gider 0
    const expenseMap = {};
    if (loggedInRole !== "doctor" && !isDoctorFilter) {
      expenseTrendAgg.forEach((doc) => {
        expenseMap[doc._id.date] = doc.dailyExpense;
      });
    }

    // Appointment trend aggregation
    let appointmentTrendMatch = {
      appointmentDate: { $gte: start, $lte: end },
      isDeleted: false,
      customerId,
    };
    if (loggedInRole === "doctor") {
      appointmentTrendMatch.doctorId = loggedInUserId;
    } else if (isDoctorFilter) {
      appointmentTrendMatch.doctorId = new mongoose.Types.ObjectId(doctorId);
    }
    const patientTrendAgg = await Appointment.aggregate([
      { $match: appointmentTrendMatch },
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

    // Oluşturulan tarih aralığı
    const dateArray = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dateArray.push(new Date(d).toISOString().split("T")[0]);
    }

    // Trend verilerini map'leyelim:
    const incomeMap = {};
    incomeTrendAgg.forEach((doc) => {
      incomeMap[doc._id.date] = doc.dailyIncome;
    });
    const patientMap = {};
    patientTrendAgg.forEach((doc) => {
      patientMap[doc._id.date] = doc.dailyPatients;
    });

    // Trend dizilerini oluştur (her tarih için)
    const trendIncome = [];
    const trendExpense = [];
    const trendProfit = [];
    const trendPatients = [];
    dateArray.forEach((date) => {
      const inc = incomeMap[date] || 0;
      // Eğer loggedInRole doctor veya doktor filtresi varsa, gider 0
      const exp =
        loggedInRole === "doctor" || isDoctorFilter ? 0 : expenseMap[date] || 0;
      let profitForDay = 0;
      if (loggedInRole === "doctor") {
        // Doktor rolündeyse, Payment aggregation'da %40 uygulanmış durumda.
        profitForDay = inc;
      } else if (isDoctorFilter) {
        // Admin/manager/superadmin için, doktor filtresi varsa kar = gelir * 0.4
        profitForDay = inc * 0.4;
      } else {
        profitForDay = inc - exp;
      }
      trendIncome.push(inc);
      trendExpense.push(exp);
      trendProfit.push(profitForDay);
      trendPatients.push(patientMap[date] || 0);
    });

    // Toplam kar hesaplaması (summary)
    let summaryProfit = 0;
    if (loggedInRole === "doctor") {
      summaryProfit = totalIncome; // zaten %40 uygulanmış durumda
    } else if (isDoctorFilter) {
      summaryProfit = totalIncome * 0.4;
    } else {
      summaryProfit = totalIncome - totalExpense;
    }

    // Son gün ile ondan önceki gün arasındaki fark yüzdesi hesaplama fonksiyonu
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

    /* BREAKDOWN */
    // Gelir Breakdown: ödeme yöntemlerine göre
    const incomeBreakdownAgg = await Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: "$paymentMethod",
          amount: {
            $sum: loggedInRole === "doctor" ? { $multiply: ["$paymentAmount", 0.4] } : "$paymentAmount",
          },
          paymentCount: { $sum: 1 } // Count number of payments per method
        },
      },
      { $sort: { amount: -1 } },
      {
        $project: {
          method: "$_id",
          amount: 1,
          paymentCount: 1
        }
      }
    ]);
    const incomeMethods = incomeBreakdownAgg.map((doc) => ({
      method: doc.method,
      amount: doc.amount,
      paymentCount: doc.paymentCount
    }));

    // Gider Breakdown: eğer doctor veya doktor filtresi varsa boş, aksi halde normal aggregation
    const expenseDescriptions =
      loggedInRole === "doctor" || isDoctorFilter
        ? []
        : expenseBreakdownAgg.map((doc) => ({
            description: doc._id,
            amount: doc.amount,
          }));

    return res.json({
      status: "success",
      updatedAt: new Date().toISOString(),
      data: {
        summary: {
          totalIncome,
          totalExpense,
          profit: summaryProfit,
          patientCount: totalPatientCount,
          incomeChange,
          expenseChange,
          profitChange,
          patientChange,
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
