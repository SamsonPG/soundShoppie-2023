const express = require("express");
const User = require("../models/users");
const Admin = require("../models/admin");
const Cart = require("../models/cart");
const Wishlist = require("../models/wishlist");
const Product = require("../models/product");
const userRouter = express.Router();
const session = require("express-session");
const mongoose = require("mongoose");

// Middleware to refresh session data
const refreshUserSession = async (req, res, next) => {
  try {
    if (!req.path.startsWith("/admin") && req.session.user) {
      const user = await User.findById(req.session.user._id);
      if (user) {
        if (user.access === "blocked") {
          // User is blocked, clear the session and redirect to the logout screen
          user.isLoggedIn = false;
          await user.save();
          req.session.user = null;
          return res.redirect("/userlogout"); // Redirect to the logout screen
        } else {
          // Update the session user object with the latest data from the database
          user.isLoggedIn = true;
          await user.save();
          req.session.user = user;
        }
      } else {
        // User not found, clear the session

        req.session.user = null;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
const userLoginVerify = (req, res, next) => {
  if (req.session.user && req.session.user.access !== "blocked") {
    next();
  } else {
    // User is not logged in or access is blocked
    // You can redirect the user to an appropriate page or return an error message
    res.redirect("/login."); // Example: Redirect to login page
  }
};
const adminLoginVerify = (req, res, next) => {
  if (req.session.admin) {
    next();
  } else {
    res.render("admin/admin_login", { title: "Admin Login" });
  }
};

module.exports = {
  refreshUserSession,
  userLoginVerify,
  adminLoginVerify,
};
