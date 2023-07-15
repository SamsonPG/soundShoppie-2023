const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    unique: true,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  price: {
    type: Number,
    default: 0.0,
    required: true,
  },

  offerprice: {
    type: Number,
    default: 0.0,
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "inactive",
  },
  description: {
    type: String,
    required: true,
  },
  images: {
    type: [String],
    required: true,
  },
  view: {
    type: String,
    enum: ["unblocked", "blocked"],
    required: true,
    default: "unblocked",
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: "{VALUE} is not an integer value for stock.",
    },
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Product", productSchema);
