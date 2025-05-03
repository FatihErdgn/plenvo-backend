# Backend Scripts

Bu klasör, veritabanı bakımı ve toplu veri işlemleri gibi görevler için kullanılan scriptleri içerir.

## Ödeme Periyodu Güncelleme Scripti (updatePaymentPeriods.js)

Bu script, daha önce yapılmış ödemeler için eksik olan `paymentPeriod` ve `periodEndDate` alanlarını doldurur.

### Açıklama

Sistem güncellemesi sonrası, eski ödemelerde bulunmayan ödeme periyodu bilgilerini güncellemek için kullanılır. Script:

- Veritabanında `paymentPeriod` veya `periodEndDate` alanı eksik olan tüm ödemeleri bulur
- Bu alanları belirtilen değerlerle günceller (varsayılan: aylık periyot, 30 Nisan 2025 bitiş tarihi)
- Güncelleme sürecini ve sonuçları konsola raporlar

### Kullanım

```bash
# Backend dizinine git
cd plenvo-backend/backend

# Varsayılan değerlerle çalıştır (aylık periyot, 30 Nisan 2025 bitiş tarihi)
node scripts/updatePaymentPeriods.js

# Özel periyot belirt
node scripts/updatePaymentPeriods.js --period=biannual

# Özel bitiş tarihi belirt
node scripts/updatePaymentPeriods.js --endDate=2025-12-31

# Hem periyot hem bitiş tarihi belirt
node scripts/updatePaymentPeriods.js --period=quarterly --endDate=2024-12-31

# Kuru çalıştırma (gerçek güncelleme yapmadan)
node scripts/updatePaymentPeriods.js --dryRun

# Yardım mesajını göster
node scripts/updatePaymentPeriods.js --help
```

### Seçenekler

- `--period=DEĞER`: Ödemelere atanacak periyot değeri
  - Geçerli değerler: `single`, `monthly`, `quarterly`, `biannual`
  - Varsayılan: `monthly`

- `--endDate=YYYY-MM-DD`: Periyot bitiş tarihi
  - Format: YYYY-MM-DD (örn: 2025-04-30)
  - Varsayılan: 2025-04-30

- `--dryRun`: Güncelleme yapmadan sadece etkilenecek kayıtları göster

- `--help`, `-h`: Yardım mesajını göster

### Güvenlik Notları

- Bu script veritabanınızda kalıcı değişiklikler yapar, önce bir yedeğinizin olduğundan emin olun
- Gerçek güncelleme yapmadan önce `--dryRun` parametresiyle test edin
- Üretim ortamında çalıştırmadan önce test ortamında deneyin 