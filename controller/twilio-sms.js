const express = require("express");
const { default: V2 } = require("twilio/lib/rest/chat/V2");
const User = require("../models/users");
const path = require("path");
const fs = require("fs");
const Product = require("../models/product");
const Cart = require("../models/cart");
const bcrypt = require("bcrypt");
const Category = require("../models/category");
const Order = require("../models/order");
const categoryController = require("../controller/categoryController");
const productController = require("../controller/productController");
const userRouter = express.Router();
const cartController = require("../controller/cartController");
const userController = require("../controller/userController");
const orderController = require("../controller/orderController");
const wishlistController = require("../controller/wishlistController");
const userProfileController = require("../controller/userProfileController");
const Carousel = require("../models/carousel");
const {
  refreshUserSession,
  userLoginVerify,
} = require("../middlewares/middlewares");

require("dotenv").config();
const { TWILIO_SERVICE_SID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } =
  process.env;
const client = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, {
  lazyLoading: true,
});

const sendOTP = async (req, res, next) => {
  const { mobile } = req.body;

  try {
    const existingMobileUser = await User.findOne({ mobile: req.body.mobile });

    if (existingMobileUser) {
      // Send OTP using Twilio
      const otpResponse = await client.verify.v2
        .services(TWILIO_SERVICE_SID)
        .verifications.create({
          to: `+91${mobile}`,
          channel: "sms",
        });
      res.render("user/otplogin", { mobile });
    } else {
      return res.render("user/mobilelogin", { msg: "Please Signup New User" });
    }
  } catch (error) {
    return res.render("user/mobilelogin", { msg: "Failed to send OTP" });
  }
};

const verifyOTP = async (req, res, next) => {
  const { mobile, otp } = req.body;

  try {
    // Verify OTP using Twilio
    const verificationResult = await client.verify.v2
      .services(TWILIO_SERVICE_SID)
      .verificationChecks.create({
        to: `+91${mobile}`,
        code: otp,
      });

    if (verificationResult.status === "approved") {
      const user = await User.findOne({ mobile: req.body.mobile });
      req.session.user = user; // Create a user session
      user.isLoggedIn = true;
      await user.save();
      const page = 1; // Set the page value to 1 for the initial rendering
      const limit = 8; // Set the limit value as per your requirements

      const totalProductCount = await productController.getTotalProductCount();
      const totalPages = Math.ceil(totalProductCount / limit);
      const startIndex = (page - 1) * limit;

      const products = await productController.paginationgetProducts(
        { query: { page, limit } },
        { json: () => {} }
      );
      const categories = await Category.find(); // Fetch categories from the database

      const thumbnailUrl = req.file ? "/uploads/user/" + user.image : null;
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId });
      const carousel = await Carousel.findOne({ carouselstatus: "active" });
      res.render("user/userHome", {
        title: "User Home",
        image: thumbnailUrl,
        user: req.session.user,
        products,
        categories,
        page,
        totalPages,
        cart: cart,
        carousel: carousel,
      });
    } else {
      return res.render("user/mobilelogin", { msg: "Invalid OTP" });
    }
  } catch (error) {
    return res.render("user/otplogin", { mobile, msg: "Invalid OTP" });
  }
};

const sendOTPSignup = async (req, res, next) => {
  const { mobile } = req.body;
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email: req.body.email });
    const existingMobileUser = await User.findOne({ mobile: req.body.mobile });

    if (existingUser) {
      // User with the same email already exists
      return res.render("user/signupMobile", {
        title: "Sign Up",
        msg: "Email Already Exists",
      });
    } else if (existingMobileUser) {
      // User with the same mobile number already exists
      return res.render("user/signupMobile", {
        title: "Sign Up",
        msg: "Mobile Number Already Exists",
      });
    } else if (req.session.user && req.session.user.access !== "blocked") {
      // An active user exists, redirect to userHome
      return res.redirect("/userHome");
    }

    // Send OTP using Twilio
    const otpResponse = await client.verify.v2
      .services(TWILIO_SERVICE_SID)
      .verifications.create({
        to: `+91${mobile}`,
        channel: "sms",
      });

    return res.render("user/otploginSignup", {
      mobile,
      name,
      email,
      password,

      msg: "",
    });
  } catch (error) {
    return res.render("user/signupMobile", { msg: "Failed to send OTP" });
  }
};

const verifyOTPSignup = async (req, res, next) => {
  const { mobile, otp, name, email, password } = req.body;
  try {
    // Verify OTP using Twilio
    const verificationResult = await client.verify.v2
      .services(TWILIO_SERVICE_SID)
      .verificationChecks.create({
        to: `+91${mobile}`,
        code: otp,
      });

    if (verificationResult.status === "approved") {
      const saltRounds = 10; // Number of salt rounds for bcrypt

      // Hash the password using bcrypt
      const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

      // Create a new user object with the hashed password
      const user = new User({
        name: req.body.name,
        email: req.body.email,
        mobile: req.body.mobile,
        password: hashedPassword,
        image: "",
      });

      user.isLoggedIn = true;
      await user.save();

      req.session.user = user; // Create a user session

      const page = 1; // Set the page value to 1 for the initial rendering
      const limit = 8; // Set the limit value as per your requirements

      const totalProductCount = await productController.getTotalProductCount();
      const totalPages = Math.ceil(totalProductCount / limit);
      const startIndex = (page - 1) * limit;

      const products = await productController.paginationgetProducts(
        { query: { page, limit } },
        { json: () => {} }
      );
      const categories = await Category.find(); // Fetch categories from the database

      const thumbnailUrl = req.file ? "/uploads/user/" + user.image : null;
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId });

      const carousel = await Carousel.findOne({ carouselstatus: "active" });
      return res.render("user/userHome", {
        title: "User Home",
        image: thumbnailUrl,
        user: req.session.user,
        products,
        categories,
        page,
        totalPages,
        cart: cart,
        carousel: carousel,
      });
    } else {
      const errorMessage = verificationResult.error
        ? verificationResult.error.message
        : "Invalid OTP";
      return res.render("user/signupMobile", { msg: "Invalid OTP" });
    }
  } catch (error) {
    return res.render("user/signupMobile", { mobile, msg: "Invalid OTP" });
  }
};

const sendOTPForgotPassword = async (req, res, next) => {
  const { mobile } = req.body;
  try {
    const existingUser = await User.findOne({ email: req.body.email });
    const existingMobileUser = await User.findOne({ mobile: req.body.mobile });

    if (existingMobileUser && existingUser) {
      // Send OTP using Twilio
      const otpResponse = await client.verify.v2
        .services(TWILIO_SERVICE_SID)
        .verifications.create({
          to: `+91${mobile}`,
          channel: "sms",
        });
      res.render("user/otpForgotPassword", {
        mobile,
        title: "Forgot Password",
        msg: "",
      });
    } else {
      return res.render("user/loginForgotPassword", {
        title: "Sign Up",
        msg: "Entered Email and Mobile doesn't Exists",
      });
    }
  } catch (error) {
    return res.render("user/loginForgotPassword", {
      msg: "Failed to send OTP",
    });
  }
};

const verifyOTPForgotPassword = async (req, res, next) => {
  const { mobile, otp } = req.body;

  try {
    // Verify OTP using Twilio
    const verificationResult = await client.verify.v2
      .services(TWILIO_SERVICE_SID)
      .verificationChecks.create({
        to: `+91${mobile}`,
        code: otp,
      });

    if (verificationResult.status === "approved") {
      res.render("user/changePassword", { mobile, title: "Change Password" });
    } else {
      return res.render("user/otpForgotPassword", { msg: "Invalid OTP" });
    }
  } catch (error) {
    return res.render("user/otpForgotPassword", { mobile, msg: "Invalid OTP" });
  }
};
const verifyChangePassword = async (req, res, next) => {
  const { mobile } = req.body;
  try {
    const user = await User.findOne({ mobile: req.body.mobile });

    const saltRounds = 10; // Number of salt rounds for bcrypt

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
    req.session.user = user; // Create a user session
    user.isLoggedIn = true;
    user.password = hashedPassword;
    await user.save();
    const page = 1; // Set the page value to 1 for the initial rendering
    const limit = 8; // Set the limit value as per your requirements

    const totalProductCount = await productController.getTotalProductCount();
    const totalPages = Math.ceil(totalProductCount / limit);
    const startIndex = (page - 1) * limit;

    const products = await productController.paginationgetProducts(
      { query: { page, limit } },
      { json: () => {} }
    );
    const categories = await Category.find(); // Fetch categories from the database

    const thumbnailUrl = req.file ? "/uploads/user/" + user.image : null;
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId });
    const carousel = await Carousel.findOne({ carouselstatus: "active" });
    res.render("user/userHome", {
      title: "User Home",
      image: thumbnailUrl,
      user: req.session.user,
      products,
      categories,
      page,
      totalPages,
      cart: cart,
      carousel: carousel,
    });
  } catch (error) {
    return res.render("user/otpForgotPassword", { mobile, msg: "Invalid OTP" });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  sendOTPSignup,
  verifyOTPSignup,
  sendOTPForgotPassword,
  verifyOTPForgotPassword,
  verifyChangePassword,
};
