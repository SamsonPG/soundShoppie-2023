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

// Set up PayPal configuration
paypal.configure({
  mode: "sandbox", // Replace with "live" for production
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

const payWithPayPal = async (req, res, next) => {
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
        product: product,
        quantity: productData.quantity,
      };

      cartProducts.push(cartProduct);
    }

    let totalAmount = 0;
    for (const cartProduct of cartProducts) {
      totalAmount += cartProduct.product.price * cartProduct.quantity;
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
    cart.products = [];
    cart.totalAmount = 0;
    cart.coupon = {
      code: "",
      discount: 0.0,
    };
    await cart.save();

    const createPayPalPayment = () =>
      new Promise((resolve, reject) => {
        const create_payment_json = {
          intent: "sale",
          payer: {
            payment_method: "paypal",
          },
          redirect_urls: {
            return_url: "http://localhost:4000/success",
            cancel_url: "http://localhost:4000/cancel",
          },
          transactions: [
            {
              item_list: {
                items: cartProducts.map((cartProduct) => ({
                  name: cartProduct.product.name,
                  sku: cartProduct.product._id.toString(),
                  price: cartProduct.product.price.toFixed(2),
                  currency: "USD",
                  quantity: cartProduct.quantity,
                })),
              },
              amount: {
                currency: "USD",
                total: totalAmount.toFixed(2),
              },
              description: "Order from your website",
            },
          ],
        };

        paypal.payment.create(create_payment_json, function (error, payment) {
          if (error) {
            Order.findByIdAndDelete(order._id)
              .then(() => {
                reject(error);
              })
              .catch((err) => {
                reject(error);
              });
          } else {
            let redirectUrl;
            for (let i = 0; i < payment.links.length; i++) {
              if (payment.links[i].rel === "approval_url") {
                redirectUrl = payment.links[i].href;
                break;
              }
            }

            if (redirectUrl) {
              resolve(redirectUrl);
            } else {
              res.redirect("/failed");
              reject(new Error("Approval URL not found"));
            }
          }
        });
      });

    const redirectUrl = await createPayPalPayment();
    res.redirect(redirectUrl);
  } catch (error) {
    res.redirect("/failed");
    next(error); // Pass the error to the error handling middleware
  }
};
module.exports = {
  payWithPayPal,
};
