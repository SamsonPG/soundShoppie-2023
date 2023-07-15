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
const {
  refreshUserSession,
  userLoginVerify,
} = require("../middlewares/middlewares");

const rendersalesReportTable = async (req, res, next) => {
  try {
    const timeframe = req.query.timeframe; // Get the timeframe from the query parameter
    let startDate, endDate;

    if (timeframe === "custom") {
      startDate = new Date(req.query.startDate); // Convert the start date from the query parameter to a Date object
      endDate = new Date(req.query.endDate); // Convert the end date from the query parameter to a Date object
      endDate.setHours(23, 59, 59, 999); // Set the end date to the end of the selected day
    } else {
      if (timeframe === "daily") {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
      } else if (timeframe === "weekly") {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Set the start date to the beginning of the week
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
      } else if (timeframe === "monthly") {
        const currentDate = new Date();
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        ); // Set the start date to the beginning of the current month
        endDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0
        ); // Set the end date to the last day of the current month
        endDate.setHours(23, 59, 59, 999); // Set the end date to the end of the selected day
      } else if (timeframe === "yearly") {
        startDate = new Date();
        startDate.setMonth(0, 1); // Set the start date to January 1st
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setMonth(11, 31); // Set the end date to December 31st
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const { startDate: formStartDate, endDate: formEndDate } = req.body; // Access the start and end dates from the request body
    if (formStartDate && formEndDate) {
      startDate = new Date(formStartDate);
      startDate.setHours(0, 0, 0, 0); // Set the end date to the end of the selected day
      endDate = new Date(formEndDate);
      endDate.setHours(23, 59, 59, 999); // Set the end date to the end of the selected day
    }

    // Fetch orders within the selected timeframe
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      orderStatus: "Delivered", // Only fetch orders with "Delivered" status
    }).populate("cart.products.product");

    // Calculate the total sales amount
    let totalSales = 0;
    orders.forEach((order) => {
      order.cart.products.forEach((product) => {
        if (product.product) {
          totalSales += product.quantity * product.product.price;
        }
      });
    });

    res.render("admin/sales_report", {
      title: "Sales Report",
      orders,
      timeframe,
      totalSales,
      startDate: startDate ? startDate.toISOString().slice(0, 10) : "",
      endDate: endDate ? endDate.toISOString().slice(0, 10) : "",
      admin: req.session.admin,
      message: req.session.message,
    }); // Pass the sales report data to the sales report view
  } catch (error) {
    res.redirect("/error"); // Redirect to an error page
  }
};

module.exports = {
  rendersalesReportTable,
};
