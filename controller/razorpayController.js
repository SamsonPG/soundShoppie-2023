const express = require("express");
const Cart = require("../models/cart");
const User = require("../models/users");
const Product = require("../models/product");
const Category = require("../models/category");
const categoryController = require("../controller/categoryController");
const productController = require("../controller/productController");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { calculateTotal } = require("../public/script/helper");
const cartController = require("../controller/cartController");
const Order = require("../models/order");
const Wallet = require("../models/wallet");
const {
  refreshUserSession,
  userLoginVerify,
} = require("../middlewares/middlewares");
const paypal = require("paypal-rest-sdk");
const dotenv = require("dotenv");
const Razorpay = require("razorpay");

// Initialize Razorpay client with your API key and secret
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const payWithRazorpay = async (req, res, next) => {
  try {
    const userId = req.body.userId;
    const selectedAddressIndex = req.body.selectedAddressIndex;
    const selectedPaymentMethod = req.body.paymentMethod;
    const deductedTotalAmount = req.body.deductedTotalAmount;
    const walletAmount = req.body.walletAmount;
    const newWalletBalance = req.body.newWalletBalance;
    const paymentOption = req.body.paymentOption;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new Error("Cart not found");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const cartProducts = [];
    for (const productData of cart.products) {
      const product = await Product.findById(productData.product);
      if (!product) {
        throw new Error("Product not found");
      }

      const cartProduct = {
        product: product._id.toString(), // Store the product ID as a string
        quantity: productData.quantity,
      };

      cartProducts.push(cartProduct);
    }

    let totalAmount = 0;
    for (const cartProduct of cartProducts) {
      const product = await Product.findById(cartProduct.product);
      totalAmount += product.price * cartProduct.quantity;
    }

    const order = new Order({
      user: userId,
      userName: user.name,
      cart: {
        products: cartProducts,
        totalAmount: totalAmount,
        coupon: cart.coupon,
        deductedTotalAmount: deductedTotalAmount,
        walletAmount: walletAmount,
        newWalletBalance: newWalletBalance,
      },
      mobile: user.mobile,
      address: user.addresses[selectedAddressIndex],
      orderStatus: "Processing",
      reason: "",
      paymentMethod: selectedPaymentMethod,
    });
    await order.save();
    if (paymentOption === "withWallet") {
      let wallet = await Wallet.findOne({ owner: userId });

      // Create a new transaction object
      const transaction = {
        order: savedOrder._id,
        walletUpdate: "walletNotCredited",
      };

      // Update the wallet balance and add the transaction to transactions
      wallet.balance = newWalletBalance;
      wallet.transactions.push(transaction);
      // await wallet.save();
      try {
        // Save the wallet
        const savedWallet = await wallet.save();
      } catch (error) {}
    }
    const options = {
      amount: totalAmount * 100, // Amount in the smallest currency unit (paise for INR)
      currency: "INR",
      receipt: "order_" + order._id.toString(), // Unique identifier for the payment
      payment_capture: 1, // Auto-capture the payment (0 for manual capture)
    };
    const razorpayOrder = await razorpay.orders.create(options);

    // Send the Razorpay order details to the frontend
    res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to initiate payment" });
    next(error); // Pass the error to the error handling middleware
  }
};

module.exports = {
  payWithRazorpay,
};
