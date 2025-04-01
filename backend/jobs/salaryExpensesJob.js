const cron = require("node-cron");
const User = require("../models/User");
const Role = require("../models/Role");
const Appointment = require("../models/Appointment");
const Payment = require("../models/Payment");
const Expense = require("../models/Expense");
const Currency = require("../models/Currency");

// Her ayın ilk günü saat 02:00'da çalışacak cron job
cron.schedule("0 2 1 * *", async () => {
  try {
    console.log(`Maaş gider kaydı işlemi başlatıldı: ${new Date().toISOString()}`);
    
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

    // Geçmiş ayın başlangıç ve bitiş tarihlerini belirliyoruz.
    const currentDate = new Date();
    const previousMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
    const previousMonthYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();
    
    const firstDayPrevMonth = new Date(previousMonthYear, previousMonth, 1, 0, 0, 0, 0);
    const lastDayPrevMonth = new Date(
      previousMonthYear, 
      previousMonth + 1, 
      0, 
      23, 
      59, 
      59, 
      999
    );
    
    console.log(`Hesaplama dönemi: ${firstDayPrevMonth.toISOString()} - ${lastDayPrevMonth.toISOString()}`);

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

      console.log(`Maaşı girilmemiş ${doctorsWithoutSalary.length} doktor kullanıcısı bulundu.`);

      for (const doctor of doctorsWithoutSalary) {
        try {
          // Geçen ay içindeki tüm ödemeleri getir (Dashboard ile aynı filtreleme)
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

          // Eğer hesaplanan maaş 0'dan büyükse gider kaydı oluştur
          if (calculatedSalary > 0) {
            const expenseData = {
              customerId: doctor.customerId,
              clinicId: doctor.clinicId,
              currencyId: foundCurrency ? foundCurrency._id : null,
              expenseCategory: "Maaş",
              expenseDescription: `Aylık maaş ödemesi (otomatik hesaplama): ${doctor.firstName} ${doctor.lastName} - ${firstDayPrevMonth.toLocaleDateString()} - ${lastDayPrevMonth.toLocaleDateString()}`,
              expenseKind: "Sabit",
              expenseAmount: calculatedSalary,
              expenseDate: new Date(),
              isDeleted: false,
              lastEditBy: doctor._id,
              lastEditDate: new Date(),
            };

            const newExpense = new Expense(expenseData);
            await newExpense.save();
            console.log(`Otomatik hesaplanan maaş gider kaydı oluşturuldu. Doktor: ${doctor._id}, Maaş: ${calculatedSalary.toFixed(2)} TL`);
          } else {
            console.log(`Doktor ${doctor.firstName} ${doctor.lastName} için geçen ay gelir kaydı bulunamadı. Maaş gider kaydı oluşturulmadı.`);
          }
        } catch (err) {
          console.error(`Doktor ${doctor._id} için maaş hesaplama hatası:`, err);
        }
      }
    }
    
    console.log(`Maaş gider kaydı işlemi tamamlandı: ${new Date().toISOString()}`);
  } catch (err) {
    console.error("Aylık maaş gider kaydı oluşturulurken hata:", err);
  }
});
