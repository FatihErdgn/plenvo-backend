const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 100, // 15 dakika içinde 100 istek
    message: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.',
});

module.exports = apiLimiter;
