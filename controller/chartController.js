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
const Chart = require("chart.js");

const calculateRevenueAndOrderCount = async () => {
  try {
    // Calculate revenue
    const revenue = await Order.aggregate([
      {
        $match: {
          orderStatus: "Delivered", // Consider only delivered orders
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$cart.totalAmount" }, // Sum the totalAmount field of all delivered orders
        },
      },
    ]);

    // Calculate total delivered order count
    const deliveredOrderCount = await Order.countDocuments({
      orderStatus: "Delivered", // Count the number of delivered orders
    });

    // Calculate total amount of orders on the current date
    const currentDate = new Date();
    const startDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate()
    );
    const endDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() + 1
    );
    const totalAmountToday = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lt: endDate }, // Consider orders within the current date
          orderStatus: "Delivered",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$cart.totalAmount" }, // Sum the totalAmount field of orders on the current date
        },
      },
    ]);

    return {
      revenue: revenue[0]?.totalRevenue || 0,
      deliveredOrderCount,
      totalAmountToday: totalAmountToday[0]?.totalAmount || 0,
    };
  } catch (error) {
    throw new Error("Error calculating revenue and order count");
  }
};

const generateDailyOrdersChart = async (req, res) => {
  try {
    const today = new Date();
    const sevenDaysAgo = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 6
    );

    const orders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo, $lte: today }, // Get orders from the last 7 days
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }, // Group orders by date
          },
          count: { $sum: 1 }, // Count the number of orders per day
        },
      },
      { $sort: { _id: 1 } }, // Sort by date in ascending order
    ]);

    const labels = orders.map((order) => order._id);
    const data = orders.map((order) => order.count);

    res.json({ labels, data });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const generateWeeklySalesChart = async (req, res) => {
  try {
    const today = new Date();
    const sevenDaysAgo = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 6
    );

    const orders = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: sevenDaysAgo,
            $lte: today,
          }, // Get orders from the last 7 days
          orderStatus: "Delivered", // Consider only delivered orders},
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%U", date: "$createdAt" }, // Group orders by year and week
          },
          totalSales: { $sum: "$cart.totalAmount" }, // Calculate the total sales amount per week
        },
      },
      { $sort: { _id: 1 } }, // Sort by week in ascending order
    ]);

    const labels = orders.map((order) => order._id);
    const data = orders.map((order) => order.totalSales);

    res.json({ labels, data });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const generateOrderStatusChart = async (req, res) => {
  try {
    const orders = await Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 }, // Count the number of orders for each status
        },
      },
    ]);

    const labels = orders.map((order) => order._id);
    const data = orders.map((order) => order.count);

    res.json({ labels, data });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
module.exports = {
  generateDailyOrdersChart,
  generateWeeklySalesChart,
  generateOrderStatusChart,
  calculateRevenueAndOrderCount,
};
