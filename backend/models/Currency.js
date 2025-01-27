const mongoose = require('mongoose');

const currencySchema = new mongoose.Schema({
    currencyName: {
        type: String,
        required: true,
    }
    });

module.exports = mongoose.model('Currency', currencySchema);