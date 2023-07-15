const express = require("express");
const landingRouter = express.Router();
const Category = require("../models/category");
const Carousel = require("../models/carousel");
const productController = require("../controller/productController");
const ITEMS_PER_PAGE = 8; // Number of items to display per page
const multer = require("multer");
const fs = require("fs");
const sharp = require("sharp");
const path = require("path");

landingRouter.get("/", async (req, res) => {
  try {
    if (!req.session.user) {
      const page = req.query.page ? parseInt(req.query.page) : 1;
      const startIndex = (page - 1) * ITEMS_PER_PAGE;

      const totalProductCount = await productController.getTotalProductCount();
      const totalPages = Math.ceil(totalProductCount / ITEMS_PER_PAGE);

      const products = await productController.paginationgetProducts(req, res); // Pass the request and response objects

      const categories = await Category.find(); // Fetch categories from the database
      const carousel = await Carousel.findOne({ carouselstatus: "active" });
      if (!carousel) {
        // Handle the scenario when no active carousel is found
        // Set a default value or render an appropriate message
      } else {
        // Continue with rendering the page using the retrieved carousel
        res.render("user/landingPage", {
          title: "Landing Page",
          products,
          categories,
          page,
          totalPages,
          carousel: carousel,
        });
      }
    }
  } catch (error) {
    res.render("error", { error: "An error occurred." });
  }
});

module.exports = landingRouter;
