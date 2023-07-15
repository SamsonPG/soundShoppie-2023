const express = require("express");
const User = require("../models/users");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const session = require("express-session");
const bodyParser = require("body-parser");
const userRouter = express.Router();
const mongoose = require("mongoose");
const quotes = require("inspirational-quotes");
const Cart = require("../models/cart");
const Order = require("../models/order");
const Product = require("../models/product");
const Wallet = require("../models/wallet");

const rendereditUserProfile = async (req, res) => {
  if (req.session.user && req.session.user.access !== "blocked") {
    const quote = quotes.getRandomQuote();
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId });
    res.render("user/editUserProfile", {
      title: "Edit User Profile",
      user: req.session.user,
      message: req.session.message,
      quote: quote,

      cart: cart,
    });
  } else {
    res.render("user/signup", { title: "Sign Up" });
  }
};

const renderUserOrder = async (req, res) => {
  if (req.session.user && req.session.user.access !== "blocked") {
    const userId = req.params.id;

    try {
      // Fetch orders for the specific user and populate the 'cart.products.product' field
      const orders = await Order.find({ user: userId })
        .sort({ createdAt: -1 })
        .populate("cart.products.product");
      const userWallet = await Wallet.findOne({ owner: userId });
      // Find orders with paymentStatus "failed"
      const failedOrders = orders.filter(
        (order) => order.paymentStatus === "failed"
      );

      // Delete failed orders and increment product stock
      for (const order of failedOrders) {
        await deleteOrder(order._id);
      }

      // Check orderStatus "Cancel" or "Return Approved" and increment stock count
      for (const order of orders) {
        if (
          (order.orderStatus === "Cancel" ||
            order.orderStatus === "Return Approved") &&
          order.backStockStatus === "notUploaded"
        ) {
          await stockUpdateReturnCancel(order._id);
        }
      }

      const cart = await Cart.findOne({ user: userId });
      res.render("user/userOrders", {
        title: "User Orders",
        user: req.session.user,
        message: req.session.message,
        cart: cart,
        wallet: userWallet,
        orders: orders.map((order) => {
          order.cart.products = order.cart.products.map((product) => {
            if (!product.product) {
              product.product = { title: "Product Removed" };
            }
            return product;
          });
          return order;
        }),
      });
    } catch (error) {
      res.redirect("/error"); // Redirect to an error page
    }
  } else {
    res.redirect("/login.");
  }
};

const stockUpdateReturnCancel = async (orderId) => {
  try {
    const order = await Order.findById(orderId).populate(
      "cart.products.product"
    );
    if (!order) {
      return;
    }

    if (
      order.orderStatus !== "Cancel" &&
      order.orderStatus !== "Return Approved"
    ) {
      return;
    }

    for (const cartItem of order.cart.products) {
      const product = await Product.findById(cartItem.product);
      if (!product) {
        continue;
      }
      product.stock += cartItem.quantity;
      await product.save();
    }

    order.backStockStatus = "uploaded";
    await order.save();

    let userWallet = await Wallet.findOne({
      owner: order.user,
      userName: order.userName,
    });

    if (!userWallet) {
      userWallet = new Wallet({
        owner: order.user,
        userName: order.userName,
        balance: 0,
        transactions: [],
      });
    }

    if (
      order.cart.paymentOption === "withoutWallet" &&
      order.paymentMethod !== "COD"
    ) {
      const totalAmount = order.cart.totalAmount;
      userWallet.balance += totalAmount;

      userWallet.transactions.push({
        order: orderId,
        walletUpdate: "walletCredited",
      });
    } else if (
      order.paymentMethod === "COD" &&
      order.orderStatus === "Return Approved" &&
      order.cart.paymentOption === "withoutWallet"
    ) {
      const userWallet = await Wallet.findOne({ owner: order.user });

      const totalAmount = order.cart.totalAmount;
      userWallet.balance += totalAmount;
      // Add the current order ID to the wallet's transactions
      userWallet.transactions.push({
        order: orderId,
        walletUpdate: "walletCredited",
      });

      // Save the wallet
      await userWallet.save();
      return;
    } else if (order.cart.paymentOption === "withWallet") {
      const populatedUserWallet = await Wallet.populate(userWallet, {
        path: "transactions.order",
      });
      const transactionIndex = populatedUserWallet.transactions.findIndex(
        (transaction) => {
          return (
            transaction.order &&
            transaction.order._id.toString() === orderId.toString() &&
            transaction.walletUpdate === "walletNotCredited"
          );
        }
      );

      if (transactionIndex !== -1) {
        const transaction = populatedUserWallet.transactions[transactionIndex];

        if (
          order.paymentMethod !== "COD" &&
          (order.orderStatus === "Cancel" ||
            order.orderStatus === "Return Approved")
        ) {
          const totalAmount = order.cart.totalAmount;
          userWallet.balance += totalAmount;
        } else if (
          order.paymentMethod === "COD" &&
          order.cart.paymentOption === "withWallet" &&
          order.orderStatus !== "Return Approved"
        ) {
          const walletAmount = order.cart.walletAmount;
          userWallet.balance += walletAmount;
        } else if (
          order.paymentMethod === "COD" &&
          order.cart.paymentOption === "withWallet" &&
          order.orderStatus === "Return Approved"
        ) {
          const totalAmount = order.cart.totalAmount;
          userWallet.balance += totalAmount;
        }

        transaction.walletUpdate = "walletCredited";
        populatedUserWallet.transactions[transactionIndex] = transaction;
      } else {
        populatedUserWallet.transactions.push({
          order: orderId,
          walletUpdate: "walletNotCredited",
        });
      }

      await populatedUserWallet.save();
    }

    await userWallet.save();
  } catch (error) {}
};

const deleteOrder = async (orderId) => {
  try {
    // Find the order by its ID and populate the 'cart.products.product' field
    const order = await Order.findById(orderId).populate(
      "cart.products.product"
    );

    if (!order) {
      return;
    }

    // Check if the order has paymentStatus "failed"
    if (order.paymentStatus !== "failed") {
      return;
    }

    // Iterate over the products in the order and increment the stock
    for (const cartItem of order.cart.products) {
      const product = await Product.findById(cartItem.product);

      if (!product) {
        continue;
      }

      product.stock += cartItem.quantity;
      await product.save();
    }

    // Delete the order
    await Order.findByIdAndRemove(orderId);
  } catch (error) {}
};
// Function to update user profile picture
const updateProfilePicture = async (req, res) => {
  try {
    // upload.single("image");
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send("User not found");
    }

    if (req.file) {
      // Generate thumbnail from the uploaded image
      const thumbnailBuffer = await sharp(req.file.path)
        .resize(100) // Adjust the size as per your requirements
        .toBuffer();

      // Save the thumbnail with a different filename
      const thumbnailFilename = `${Date.now()}-thumbnail-${
        req.file.originalname
      }`;
      const thumbnailPath = path.join("uploads", "user", thumbnailFilename);
      await sharp(thumbnailBuffer).toFile(thumbnailPath);

      // Assign the thumbnail filename to the user object
      user.image = thumbnailFilename;

      // Delete the temporary uploaded file
      fs.unlinkSync(req.file.path);

      await user.save();

      req.session.message = {
        type: "success",
        message: "Profile picture updated successfully!",
      };
      res.redirect(`/userProfile`);
    } else {
      return res.status(400).send("No file uploaded");
    }
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect(`/userProfile`);
  }
};

// Function to update user's name, mobile, and email
const updateUserInfo = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, email, mobile } = req.body;
    if (!name || !email || !mobile) {
      return res
        .status(400)
        .send("Please provide name, email, and mobile number");
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).send("User not found");
    }

    user.name = name;
    user.email = email;
    user.mobile = mobile;

    await user.save();

    req.session.message = {
      type: "success",
      message: "User information updated successfully!",
    };
    res.redirect(`/userProfile`);
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect(`/userProfile`);
  }
};

const updateUserAddress = async (req, res) => {
  try {
    const id = req.params.id;
    const { addresses } = req.body;
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).send("Please provide addresses array");
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Update or create addresses
    for (const addressData of addresses) {
      const {
        addressId,
        houseName,
        street,
        village,
        district,
        state,
        pincode,
      } = addressData;

      if (addressId) {
        // Update existing address
        const existingAddress = user.addresses.find(
          (address) => address._id.toString() === addressId
        );
        if (existingAddress) {
          existingAddress.houseName = houseName;
          existingAddress.street = street;
          existingAddress.village = village;
          existingAddress.district = district;
          existingAddress.state = state;
          existingAddress.pincode = pincode;
        }
      } else if (
        houseName &&
        street &&
        village &&
        district &&
        state &&
        pincode
      ) {
        // Create new address
        const newAddress = {
          houseName,
          street,
          village,
          district,
          state,
          pincode,
        };
        user.addresses.push(newAddress);
      }
    }

    await user.save();

    req.session.message = {
      type: "success",
      message: "User address updated successfully!",
    };
    res.redirect(`/userProfile`);
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect(`/userProfile`);
  }
};

const profileaddressAdd = async (req, res) => {
  try {
    const userId = req.params.Id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    const address = user.addresses.length > 0 ? user.addresses[0] : null;
    res.redirect(`/userProfile`);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

const profileupdateAddress = async (req, res) => {
  try {
    const {
      userId,
      selectedAddress,
      houseName,
      street,
      village,
      district,
      state,
      pincode,
    } = req.body;

    // Check if required fields are missing
    if (
      !userId ||
      (selectedAddress === undefined &&
        (!houseName || !street || !village || !district || !state || !pincode))
    ) {
      return res.status(400).send("Please provide all required fields");
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Update existing address
    if (selectedAddress !== undefined && selectedAddress !== "none") {
      const selectedAddressIndex = parseInt(selectedAddress);

      if (selectedAddressIndex >= user.addresses.length) {
        return res.status(400).send("Invalid selected address");
      }

      // Modify the address fields as required
      const updatedAddress = {
        ...user.addresses[selectedAddressIndex],
        houseName,
        street,
        village,
        district,
        state,
        pincode,
      };

      user.addresses[selectedAddressIndex] = updatedAddress;
    }
    // Add new address
    else if (user.addresses.length < 3) {
      const newAddress = {
        houseName,
        street,
        village,
        district,
        state,
        pincode,
      };

      user.addresses.push(newAddress);
    }
    // Maximum limit of 3 addresses reached
    else {
      return res.status(400).send("Maximum limit of addresses reached");
    }

    await user.save();
    res.redirect(`/userProfile` + userId);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};
const profileaddUserAddress = async (req, res) => {
  try {
    const {
      userId,
      addressIndex,
      houseName,
      street,
      village,
      district,
      state,
      pincode,
      selectedAddress,
    } = req.body;

    // Check if required fields are missing
    if (
      !userId ||
      !addressIndex ||
      !houseName ||
      !street ||
      !village ||
      !district ||
      !state ||
      !pincode
    ) {
      return res.status(400).send("Please provide all required address fields");
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Check if addressIndex is valid
    const index = parseInt(addressIndex);
    if (isNaN(index) || index < 0 || index > user.addresses.length) {
      return res.status(400).send("Invalid address index");
    }

    const address = {
      houseName,
      street,
      village,
      district,
      state,
      pincode,
    };

    // Insert the new address at the specified index
    user.addresses.splice(index, 0, address);

    // If the number of addresses exceeds the maximum limit, remove the last address
    if (user.addresses.length > 2) {
      user.addresses.pop();
    }

    // Remove the selected address if provided
    if (selectedAddress === "address1") {
      user.addresses.splice(0, 1);
    }
    if (selectedAddress === "address2") {
      user.addresses.splice(1, 1);
    }
    user.selectedAddress = selectedAddress; // Update the selected address
    await user.save();

    req.session.message = {
      type: "success",
      message: "Address added successfully!",
    };
    res.redirect(`/userProfile`);
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect(`/userProfile`);
  }
};

// Function to change user's password
const changePassword = async (req, res) => {
  try {
    const id = req.params.id;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).send("Please provide old and new password");
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).send("User not found");
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).send("Invalid old password");
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashedPassword;

    await user.save();

    req.session.message = {
      type: "success",
      message: "Password changed successfully!",
    };
    res.redirect(`/userProfile`);
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect(`/userProfile`);
  }
};

module.exports = {
  changePassword,
  updateUserAddress,
  updateUserInfo,
  updateProfilePicture,
  rendereditUserProfile,
  renderUserOrder,
  profileaddressAdd,
  profileupdateAddress,
  profileaddUserAddress,
};
