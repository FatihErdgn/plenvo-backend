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
      const NGROK_URL = process.env.NGROK_URL || "https://00b4-212-253-219-209.ngrok-free.app";
      
      client = axios.create({
        headers: {
          'Origin': NGROK_URL,
          'Referer': NGROK_URL,
          'Host': 'api.pullsms.com',
          'X-Forwarded-Host': NGROK_URL.replace('https://', '')
        }
      });
    }
    
    const requestPayload = {
      phones: formattedPhones,
      webhookId,
      message
    };

    const requestHeaders = {
      'Content-Type': 'application/json',
      'apiKey': apiKey,
      'lang': 'tr'
    };

    console.log("PullSMS API İsteği Gönderiliyor:", { 
      url: 'https://api.pullsms.com/api/v1/webhook', 
      payload: requestPayload, 
      headers: { ...requestHeaders, apiKey: '***' } // API Key'i loglamayalım
    });

    const response = await client.post('https://api.pullsms.com/api/v1/webhook', requestPayload, { headers: requestHeaders });
    
    console.log("PullSMS API Yanıtı Alındı:", response.data);
    
    if (
      (response.data && response.data.status === 'success') || 
      (response.data && response.data.description && response.data.description.includes('başarılı'))
    ) {
      return { success: true, data: response.data };
    } else {
      console.error("PullSMS API Hata Yanıtı:", response.data);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.error("PullSMS API ÇAĞRI HATASI DETAYLARI:", {
        message: error.message,
        code: error.code, 
        isAxiosError: error.isAxiosError,
        requestConfig: error.config ? {
          url: error.config.url,
          method: error.config.method,
          headers: { ...error.config.headers, apiKey: '***' }, // API Key'i loglamayalım
          timeout: error.config.timeout
        } : undefined,
        responseStatus: error.response?.status,
        responseData: error.response?.data
    });
    return { 
      success: false, 
      error: error.message, 
      details: error.response?.data || `Kod: ${error.code}, Mesaj: ${error.message}`
    };
  }
};

/**
 * Mesaj izleme - Müşterinin gönderilen mesaj sayısını artırır
 * @param {string} customerId - Müşteri ID'si
 */
const trackMessageSent = async (customerId) => {
  try {
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
