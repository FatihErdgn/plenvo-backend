const https = require('follow-redirects').https;

const sendSMS = async (toNumbers, messageText) => {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            hostname: process.env.INFOBIP_HOSTNAME, // Infobip base hostname
            path: '/sms/2/text/advanced',
            headers: {
                Authorization: `App ${process.env.INFOBIP_API_KEY}`, // API Key
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            maxRedirects: 20,
        };

        const req = https.request(options, function (res) {
            let chunks = [];

            res.on('data', function (chunk) {
                chunks.push(chunk);
            });

            res.on('end', function () {
                const body = Buffer.concat(chunks).toString();
                console.log('Infobip Response:', body);
                resolve(body);
            });

            res.on('error', function (error) {
                console.error('Infobip Error:', error);
                reject(error);
            });
        });

        // Post data format
        const postData = JSON.stringify({
            messages: [
                {
                    destinations: toNumbers.map((to) => ({ to })), // Numaraları listeye çevir
                    from: process.env.INFOBIP_SENDER_ID || 'ServiceSMS', // Gönderici adı
                    text: messageText,
                },
            ],
        });

        req.write(postData);
        req.end();
    });
};

module.exports = sendSMS;
