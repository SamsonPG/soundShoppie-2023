const express = require("express");
const adminRouter = express.Router();
const User = require("../models/users");
const Admin = require("../models/admin");
const Category = require("../models/category");
const Product = require("../models/product");
const userController = require("../controller/userController");
const categoryController = require("../controller/categoryController");
const productController = require("../controller/productController");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Define the destination directory for uploaded files
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    // Define the filename for uploaded files
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

const renderUsersPage = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.render("admin/admin_login", { title: "Admin Login" });
    }

    const users = await User.find();
    const admin = await Admin.find();

    res.render("admin/users_table", {
      title: "Admin User Panel",
      users,
      admin,
      message: req.session.message,
    });
  } catch (error) {
    res.json({ msg: error.message });
  }
};

const renderCategoryPage = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.render("admin/admin_login", { title: "Admin Login" });
    }

    const categories = await Category.find(); // Fetch categories from the database

    res.render("admin/categories_table", {
      title: "Admin Category Panel",
      categories,
      message: req.session.message,
    });
  } catch (error) {
    res.json({ msg: error.message });
  }
};

const renderProductsPage = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.render("admin/admin_login", { title: "Admin Login" });
    }

    const categories = await Category.find(); // Fetch categories from the database
    const products = await Product.find(); // Fetch products from the database
    res.render("admin/products_table", {
      title: "Admin Products Panel",
      categories,
      products,
      message: req.session.message,
      product: products,
    });
  } catch (error) {
    res.json({ msg: error.message });
  }
};

module.exports = {
  renderUsersPage,
  renderCategoryPage,
  renderProductsPage,
};
