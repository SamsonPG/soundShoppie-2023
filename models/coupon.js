const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
  },
  startingDate: {
    type: Date,
    required: true,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  discount: {
    type: Number,
    required: false,
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "inactive",
  },
  created: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

module.exports = mongoose.model("Coupons", couponSchema);
