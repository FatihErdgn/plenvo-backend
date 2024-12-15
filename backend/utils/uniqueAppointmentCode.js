const crypto = require('crypto');

const generateUniqueAppointmentCode = () => {
    return crypto.randomBytes(4).toString('hex'); // 8 karakterli benzersiz kod
};

module.exports = generateUniqueAppointmentCode;
