const axios = require("axios");
require("dotenv").config({
    path: `.env.${process.env.NODE_ENV || "development"}`,
  });

/**
 * PullSMS API aracılığıyla WhatsApp mesajı gönderme.
 * @param {string} apiKey - Müşterinin API Anahtarı
 * @param {Array} phones - Telefon numaraları dizisi (başında 90 olacak şekilde)
 * @param {string} message - Gönderilecek mesaj
 * @param {number} webhookId - PullSMS webhook ID
 * @returns {Promise} İşlem sonucu
 */
const sendWhatsAppMessage = async (apiKey, phones, message, webhookId = 5) => {
  try {
    if (!apiKey) {
      console.error("PullSMS API anahtarı sağlanmadı");
      return { success: false, error: "API anahtarı eksik" };
    }
    
    if (!phones || phones.length === 0) {
      console.error("Geçerli telefon numarası sağlanmadı");
      return { success: false, error: "Geçerli telefon numarası eksik" };
    }
    
    // Telefon numaralarını kontrol et ve biçimlendir
    const formattedPhones = phones.map(phone => {
      // Başındaki 0'ı kaldır, 90 ile başlamasını sağla
      if (phone.startsWith("0")) {
        return "9" + phone;
      }
      // Başında + işareti varsa kaldır 
      if (phone.startsWith("+")) {
        return phone.substring(1);
      }
      // Başında 90 yoksa ekle
      if (!phone.startsWith("90")) {
        return "90" + phone;
      }
      return phone;
    });

    // Development ortamında ngrok kullan, production'da doğrudan API'ye istek yap
    const isDevelopment = process.env.NODE_ENV === 'development';
    let client = axios;
    
    if (isDevelopment) {
      // Environment variables'dan Ngrok URL'i al ya da sabit URL kullan
      // Eğer .env.development dosyasında NGROK_URL tanımlanmışsa onu kullanır
      // Tanımlanmamışsa buradaki sabiti kullanır
      const NGROK_URL = process.env.NGROK_URL || "https://00b4-212-253-219-209.ngrok-free.app";
      
      // Development için axios instance
      client = axios.create({
        headers: {
          'Origin': NGROK_URL,
          'Referer': NGROK_URL,
          'Host': 'api.pullsms.com',
          'X-Forwarded-Host': NGROK_URL.replace('https://', '')
        }
      });
      // console.log("Development ortamında Ngrok proxy kullanılıyor:", NGROK_URL);
      // console.log("client: ", client);
    }
    
    // İsteği client ile yap (development'ta axiosInstance, production'da normal axios)
    const response = await client.post('https://api.pullsms.com/api/v1/webhook', {
      phones: formattedPhones,
      webhookId,
      message
    }, {
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKey,
        'lang': 'tr'
      }
    });
    
    console.log("PullSMS yanıtı:", response.data);
    
    // Success check - either status is success OR description contains 'başarılı'
    if (
      (response.data && response.data.status === 'success') || 
      (response.data && response.data.description && response.data.description.includes('başarılı'))
    ) {
      return { success: true, data: response.data };
    } else {
      console.error("PullSMS hata döndürdü:", response.data);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.error("PullSMS hatası:", error.message);
    return { 
      success: false, 
      error: error.message,
      details: error.response?.data || 'Detay yok'
    };
  }
};

/**
 * Mesaj izleme - Müşterinin gönderilen mesaj sayısını artırır
 * @param {string} customerId - Müşteri ID'si
 */
const trackMessageSent = async (customerId) => {
  try {
    // Customer modelini dinamik olarak yükle (döngüsel bağımlılıklardan kaçınmak için)
    const Customer = require('../models/Customer');
    await Customer.findByIdAndUpdate(customerId, {
      $inc: { sentMessageCount: 1 }
    });
    console.log(`${customerId} için mesaj sayacı artırıldı`);
  } catch (error) {
    console.error("Mesaj izleme hatası:", error);
  }
};

module.exports = {
  sendWhatsAppMessage,
  trackMessageSent
};
