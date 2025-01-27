const mongoose = require("mongoose");

const clinicSchema = new mongoose.Schema({
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
    },
    clinicName: {
        type: String,
        required: true,
    },
    clinicDescription: {
        type: String,
        required: true,
    },
});

module.exports = mongoose.model("Clinic", clinicSchema);