/**
 * Bu script, daha önce yapılmış ve paymentPeriod ve periodEndDate alanları olmayan
 * ödemeleri günceller ve bu alanları doldurur.
 * 
 * Eksik alanlar şu şekilde doldurulur:
 * - paymentPeriod: Varsayılan "monthly" olarak ayarlanır (komut satırı argümanı ile değiştirilebilir)
 * - periodEndDate: Varsayılan 30 Nisan 2025 olarak ayarlanır (komut satırı argümanı ile değiştirilebilir)
 * 
 * Çalıştırma Örnekleri:
 * 1. Varsayılan değerleri kullan:
 *    node scripts/updatePaymentPeriods.js
 * 
 * 2. Özel periyot belirt:
 *    node scripts/updatePaymentPeriods.js --period=biannual
 * 
 * 3. Özel bitiş tarihi belirt:
 *    node scripts/updatePaymentPeriods.js --endDate=2025-12-31
 * 
 * 4. Hem periyot hem bitiş tarihi belirt:
 *    node scripts/updatePaymentPeriods.js --period=quarterly --endDate=2024-12-31
 * 
 * 5. Kuru çalıştırma (gerçek güncelleme yapmadan):
 *    node scripts/updatePaymentPeriods.js --dryRun
 */

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const config = require('../config/database');

// Komut satırı argümanlarını işle
const args = process.argv.slice(2);
let period = 'monthly'; // Varsayılan periyot
let endDateStr = '2025-04-30'; // Varsayılan bitiş tarihi
let dryRun = false; // Varsayılan olarak gerçek güncelleme yap

// Argümanları işle
args.forEach(arg => {
  if (arg.startsWith('--period=')) {
    const newPeriod = arg.split('=')[1];
    if (['single', 'monthly', 'quarterly', 'biannual'].includes(newPeriod)) {
      period = newPeriod;
    } else {
      console.error(`Hata: Geçersiz periyot değeri: ${newPeriod}`);
      console.error('Geçerli değerler: single, monthly, quarterly, biannual');
      process.exit(1);
    }
  } else if (arg.startsWith('--endDate=')) {
    endDateStr = arg.split('=')[1];
    // Tarih formatını kontrol et
    const testDate = new Date(endDateStr);
    if (isNaN(testDate.getTime())) {
      console.error(`Hata: Geçersiz tarih formatı: ${endDateStr}`);
      console.error('Doğru format: YYYY-MM-DD (örn: 2025-04-30)');
      process.exit(1);
    }
  } else if (arg === '--dryRun') {
    dryRun = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Ödeme Periyotu Güncelleme Scripti
---------------------------------
Bu script, paymentPeriod ve periodEndDate alanları eksik olan ödemeleri günceller.

Kullanım:
  node scripts/updatePaymentPeriods.js [seçenekler]

Seçenekler:
  --period=DEĞER       Ödemelere atanacak periyot değeri (single, monthly, quarterly, biannual)
                       Varsayılan: monthly
  
  --endDate=YYYY-MM-DD Periyot bitiş tarihi
                       Varsayılan: 2025-04-30
  
  --dryRun             Güncelleme yapmadan sadece etkilenecek kayıtları göster
  
  --help, -h           Bu yardım mesajını göster
`);
    process.exit(0);
  } 
});

// Hedef bitiş tarihi: Gün sonuna ayarla
const targetEndDate = new Date(`${endDateStr}T23:59:59.999Z`);

// MongoDB bağlantısı
mongoose.connect(config.database, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB bağlantısı başarılı'))
.catch(err => {
  console.error('MongoDB bağlantı hatası:', err);
  process.exit(1);
});

// Ana işlem fonksiyonu
async function updatePaymentPeriods() {
  try {
    console.log(`Yapılandırma:
- Periyot: ${period}
- Bitiş Tarihi: ${targetEndDate.toISOString().split('T')[0]}
- Kuru Çalıştırma: ${dryRun ? 'Evet (güncelleme yapılmayacak)' : 'Hayır (güncelleme yapılacak)'}`);

    // paymentPeriod veya periodEndDate alanı eksik olan ödemeleri bul
    // $or operatörü ile herhangi biri olmayan veya null olanları seçiyoruz
    const paymentsToUpdate = await Payment.find({
      $or: [
        { paymentPeriod: { $exists: false } },
        { paymentPeriod: null },
        { periodEndDate: { $exists: false } },
        { periodEndDate: null }
      ],
      isDeleted: false // Sadece silinmemiş ödemeleri güncelle
    });

    console.log(`\nToplam ${paymentsToUpdate.length} ödeme kaydı güncellenecek.`);
    
    if (paymentsToUpdate.length === 0) {
      console.log('Güncellenecek ödeme bulunamadı.');
      process.exit(0);
    }

    // Kuru çalıştırma modunda detayları göster ve çık
    if (dryRun) {
      console.log('\nKuru çalıştırma modu: Güncelleme yapılmayacak.');
      console.log('Etkilenecek ilk 5 ödeme:');
      
      for (let i = 0; i < Math.min(5, paymentsToUpdate.length); i++) {
        const payment = paymentsToUpdate[i];
        console.log(`ID: ${payment._id}`);
        console.log(`  AppointmentID: ${payment.appointmentId}`);
        console.log(`  Mevcut paymentPeriod: ${payment.paymentPeriod || 'yok'}`);
        console.log(`  Mevcut periodEndDate: ${payment.periodEndDate || 'yok'}`);
        console.log(`  Yeni değerler: ${period}, ${targetEndDate.toISOString().split('T')[0]}`);
        console.log('---');
      }
      
      console.log(`\nGüncellemeyi gerçekleştirmek için --dryRun parametresini kaldırın.`);
      process.exit(0);
    }

    let successCount = 0;
    let errorCount = 0;

    // Her bir ödemeyi güncelle
    for (const payment of paymentsToUpdate) {
      try {
        payment.paymentPeriod = period;
        payment.periodEndDate = targetEndDate;
        
        await payment.save();
        successCount++;
        
        // İlerleme durumunu göster
        if (successCount % 100 === 0 || successCount === paymentsToUpdate.length) {
          console.log(`${successCount}/${paymentsToUpdate.length} ödeme güncellendi.`);
        }
      } catch (err) {
        console.error(`Ödeme ID: ${payment._id} güncellenirken hata:`, err.message);
        errorCount++;
      }
    }

    console.log('\nGüncelleme tamamlandı:');
    console.log(`Başarılı: ${successCount}`);
    console.log(`Hatalı: ${errorCount}`);
    console.log(`Toplam: ${paymentsToUpdate.length}`);

  } catch (err) {
    console.error('Güncelleme işleminde genel hata:', err);
  } finally {
    // Veritabanı bağlantısını kapat
    mongoose.connection.close();
    console.log('Veritabanı bağlantısı kapatıldı.');
  }
}

// Scripti çalıştır
console.log('Ödeme periyodu güncelleme işlemi başlatılıyor...');
updatePaymentPeriods(); 