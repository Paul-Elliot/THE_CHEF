const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
    Receipename: String,
    user : String,
    time: String,
    scheduledate: {type: Date},
    date: {
        type: Date,
        default: Date.now()
    }
});

module.exports = mongoose.model("Schedule",scheduleSchema);