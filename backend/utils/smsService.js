const https = require('follow-redirects').https;

const sendSMS = async (customer, toNumbers, messageText) => {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      hostname: process.env.INFOBIP_HOSTNAME, // Değişmeyecekse global hostname
      path: '/sms/2/text/advanced',
      headers: {
        Authorization: `App ${customer.smsApiKey || process.env.INFOBIP_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      maxRedirects: 20,
    };

    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        console.log('Infobip Response:', body);
        resolve(body);
      });
      res.on('error', (error) => {
        console.error('Infobip Error:', error);
        reject(error);
      });
    });

    const postData = JSON.stringify({
      messages: [
        {
          destinations: toNumbers.map((to) => ({ to })),
          from: customer.smsSenderId || process.env.INFOBIP_SENDER_ID,
          text: messageText,
        },
      ],
    });

    req.write(postData);
    req.end();
  });
};

module.exports = sendSMS;
