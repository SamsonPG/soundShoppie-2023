const mongoose = require("mongoose");
const addressSchema = new mongoose.Schema({
  houseName: {
    type: String,
    required: true,
  },
  street: {
    type: String,
    required: true,
  },
  village: {
    type: String,
    required: true,
  },
  district: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  pincode: {
    type: String,
    required: true,
  },
});
const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  cart: {
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
    walletAmount: {
      type: Number,
      default: 0.0,
    },
    newWalletBalance: {
      type: Number,
      default: 0.0,
    },
    deductedTotalAmount: {
      type: Number,
      default: 0.0,
    },
    totalAmount: {
      type: Number,
      default: 0.0,
    },
    paymentOption: {
      type: String,
      enum: ["withWallet", "withoutWallet"],
      default: "withoutWallet",
      required: true,
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
  },
  mobile: {
    type: String,
    required: true,
  },
  address: {
    type: addressSchema,
    required: true,
  },
  orderStatus: {
    type: String,
    enum: [
      "Processing",
      "Shipped",
      "Delivered",
      "Cancel",
      "Delayed",
      "Return",
      "Return Approved",
      "Return Cancelled",
    ],
    default: "Processing",
  },
  reason: {
    type: String,
    required: function () {
      return this.orderStatus === "Return";
    },
  },
  paymentMethod: {
    type: String,
    enum: ["COD", "PayPal", "Razorpay"],
    required: true,
  },
  shippedTimestamp: {
    type: Date,
    default: null,
  },
  deliveredTimestamp: {
    type: Date,
    default: null,
  },
  paymentStatus: {
    type: String,
    enum: ["success", "failed"],
    default: "failed",
    required: true,
  },

  backStockStatus: {
    type: String,
    enum: ["uploaded", "notUploaded"],
    default: "notUploaded",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Order", orderSchema);
