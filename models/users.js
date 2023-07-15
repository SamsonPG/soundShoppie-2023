const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  houseName: {
    type: String,
  },
  street: {
    type: String,
  },
  village: {
    type: String,
  },
  district: {
    type: String,
  },
  state: {
    type: String,
  },
  pincode: {
    type: String,
  },
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^\d{10}$/.test(v);
      },
      message: "Your mobile number should be 10 digits",
    },
  },
  password: {
    type: String,
    required: true,
  },
  addresses: {
    type: [addressSchema],
  },
  image: {
    type: String, // Assuming the image will be stored as a file path
  },
  access: {
    type: String,
    required: true,
    default: "unblocked",
  },
  coupon: {
    type: [String],
    default: [],
  },
  wallet: {
    type: Number,
    default: 0.0,
  },
  isLoggedIn: {
    type: Boolean,
    default: false,
  },
  created: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
