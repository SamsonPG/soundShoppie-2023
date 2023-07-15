const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1,
      },
      finalprice: {
        type: Number,
        default: 0.0,
      },
    },
  ],
  totalAmount: {
    type: Number,
    default: 0.0,
  },
  coupon: {
    code: {
      type: String,
      default: "",
    },
    discount: {
      type: Number,
      default: 0.0,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Cart", cartSchema);
