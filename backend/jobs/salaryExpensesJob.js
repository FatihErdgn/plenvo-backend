const cron = require("node-cron");
const User = require("../models/User");
const Role = require("../models/Role");
const Appointment = require("../models/Appointment");
const Payment = require("../models/Payment");
const Expense = require("../models/Expense");
const Currency = require("../models/Currency");

// Her ayın ilk günü saat 00:00'da çalışacak cron job
cron.schedule("0 0 1 * *", async () => {
  try {
    // Standart durum: salary değeri girilmiş kullanıcılar (0'dan büyük)
    const usersWithSalary = await User.find({
      salary: { $exists: true, $gt: 0 },
      isDeleted: false,
    });

    // Default para birimi (örneğin TRY) kontrolü
    const defaultCurrencyName = "TRY";
    const foundCurrency = await Currency.findOne({
      currencyName: defaultCurrencyName,
    });
    if (!foundCurrency) {
      console.error(`Para birimi "${defaultCurrencyName}" bulunamadı.`);
    }

    // Sabit maaş için expense kaydı oluşturuluyor
    for (const user of usersWithSalary) {
      const expenseData = {
        customerId: user.customerId,
        clinicId: user.clinicId,
        currencyId: foundCurrency ? foundCurrency._id : null,
        expenseCategory: "Maaş",
        expenseDescription: `Aylık maaş ödemesi: ${user.firstName} ${user.lastName}`,
        expenseKind: "Sabit",
        expenseAmount: user.salary,
        expenseDate: new Date(),
        isDeleted: false,
        lastEditBy: user._id,
        lastEditDate: new Date(),
      };

      const newExpense = new Expense(expenseData);
      await newExpense.save();
      console.log(`Sabit maaş gider kaydı oluşturuldu. Kullanıcı: ${user._id}`);
    }

    // Doktor rolündeki ve maaşı girilmemiş (veya 0) kullanıcılar için hesaplama yapılıyor.
    const doctorRole = await Role.findOne({ roleName: "doctor" });
    if (!doctorRole) {
      console.error("Doctor rolü bulunamadı.");
    } else {
      const doctorsWithoutSalary = await User.find({
        roleId: doctorRole._id,
        $or: [{ salary: { $exists: false } }, { salary: { $eq: 0 } }],
        isDeleted: false,
      });

      // Geçmiş ayın başlangıç ve bitiş tarihlerini belirliyoruz.
      let currentDate = new Date();
      let firstDayPrevMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      );
      let lastDayPrevMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        0,
        23,
        59,
        59,
        999
      );

      for (const doctor of doctorsWithoutSalary) {
        // Geçen ay içindeki tüm ödemeleri getir (sadece hizmet tipine göre filtre yapmadan)
        const payments = await Payment.find({
          userId: doctor._id,
          isDeleted: false,
          paymentStatus: { $in: ["Tamamlandı", "Ödeme Bekleniyor"] },
          paymentDate: { $gte: firstDayPrevMonth, $lte: lastDayPrevMonth },
        });

        // Toplam geliri hesapla
        let totalIncome = 0;
        payments.forEach((payment) => {
          totalIncome += payment.paymentAmount;
        });

        // Dashboard ile aynı şekilde hesapla: toplam gelirin %40'ı
        let calculatedSalary = totalIncome * 0.4;

        const expenseData = {
          customerId: doctor.customerId,
          clinicId: doctor.clinicId,
          currencyId: foundCurrency ? foundCurrency._id : null,
          expenseCategory: "Maaş",
          expenseDescription: `Aylık maaş ödemesi (otomatik hesaplama): ${doctor.firstName} ${doctor.lastName} - Toplam Gelir: ${totalIncome.toFixed(2)} TL`,
          expenseKind: "Sabit",
          expenseAmount: calculatedSalary,
          expenseDate: new Date(),
          isDeleted: false,
          lastEditBy: doctor._id,
          lastEditDate: new Date(),
        };

        const newExpense = new Expense(expenseData);
        await newExpense.save();
        console.log(
          `Otomatik hesaplanan maaş gider kaydı oluşturuldu. Doktor: ${doctor._id}`
        );
      }
    }
  } catch (err) {
    console.error("Aylık maaş gider kaydı oluşturulurken hata:", err);
  }
});
