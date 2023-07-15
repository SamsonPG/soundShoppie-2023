const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  userName: {
    type: String,

    required: true,
  },
  balance: {
    type: Number,
    default: 0.0,
  },
  transactions: [
    {
      order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
      walletUpdate: {
        type: String,
        enum: ["walletCredited", "walletNotCredited"],
        default: "walletNotCredited",
        required: true,
      },
    },
  ],
});

const Wallet = mongoose.model("Wallet", walletSchema);

module.exports = Wallet;
