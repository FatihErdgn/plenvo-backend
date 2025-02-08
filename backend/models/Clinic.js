const mongoose = require("mongoose");

const clinicSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
    },
    clinicName: {
        type: String,
        required: true,
    }
});

module.exports = mongoose.model("Clinic", clinicSchema);