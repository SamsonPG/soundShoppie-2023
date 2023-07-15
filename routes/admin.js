const express = require("express");
const adminRouter = express.Router();
const User = require("../models/users");
const Admin = require("../models/admin");
const Category = require("../models/category");
const Product = require("../models/product");
const userController = require("../controller/userController");
const categoryController = require("../controller/categoryController");
const productController = require("../controller/productController");
const adminController = require("../controller/adminController");
const multer = require("multer");
const orderController = require("../controller/orderController");
const salesController = require("../controller/salesController");
const { adminLoginVerify } = require("../middlewares/middlewares");
const { generateGraphData } = require("../controller/chartController");
const chartController = require("../controller/chartController");
const quotes = require("inspirational-quotes");
const couponController = require("../controller/couponController");
const mediaController = require("../controller/mediaController");
const {
  calculateRevenueAndOrderCount,
} = require("../controller/chartController");

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

// Delete user route
adminRouter.get("/delete/:id", adminLoginVerify, userController.deleteUser);

// Block user route
adminRouter.post("/block/:id", adminLoginVerify, userController.blockUser);

// Unblock user route
adminRouter.post("/unblock/:id", adminLoginVerify, userController.unblockUser);

// Add category route
adminRouter.get(
  "/category/add",
  adminLoginVerify,
  categoryController.renderAddCategoryPage
);
adminRouter.post(
  "/category/add",
  adminLoginVerify,
  categoryController.addCategory
);

// Edit category route
adminRouter.get(
  "/category/edit/:id",
  adminLoginVerify,
  categoryController.editCategory
);

// Update category route
adminRouter.post("/category/update/:id", categoryController.updateCategory);

// Delete category route
adminRouter.get(
  "/category/delete/:id",
  adminLoginVerify,
  categoryController.deleteCategory
);

// Add product route// Add product route
adminRouter.get(
  "/addProduct",
  adminLoginVerify,
  productController.renderAddProductPage
);
adminRouter.post(
  "/addProduct",
  adminLoginVerify,
  upload.array("images"),
  productController.addProduct
);
adminRouter.get(
  "/product/add",
  adminLoginVerify,
  productController.renderAddProductPage
);
adminRouter.post(
  "/product/add",
  adminLoginVerify,
  upload.array("images"),
  productController.addProduct
);

// Edit product route
adminRouter.get(
  "/product/edit/:id",
  adminLoginVerify,
  productController.editProduct
);

// Update product route
adminRouter.post(
  "/product/update/:id",
  adminLoginVerify,
  upload.array("images"),
  productController.updateProduct
);

// Delete product route
adminRouter.get(
  "/product/delete/:id",
  adminLoginVerify,
  productController.deleteProduct
);

// Block product route
adminRouter.post(
  "/product/block/:id",
  adminLoginVerify,
  productController.blockProduct
);

// Unblock product route
adminRouter.post(
  "/product/unblock/:id",
  adminLoginVerify,
  productController.unblockProduct
);

adminRouter.get("/admin", async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.render("admin/admin_login", { title: "Admin Login" });
    }
    // Pass the revenue variable to the view
    const { revenue, deliveredOrderCount, totalAmountToday } =
      await calculateRevenueAndOrderCount();

    const quote = quotes.getRandomQuote();
    res.render("admin/index", {
      title: "Admin Panel",
      message: req.session.message,
      quote: quote,
      revenue,
      deliveredOrderCount,
      totalAmountToday,
    });
  } catch (error) {
    res.json({ msg: error.message });
  }
});

// Create a new route for fetching graph data
adminRouter.get("/graphdata", async (req, res) => {
  try {
    // Generate the graph data
    res.json(graphData); // Send the graph data as JSON response
  } catch (error) {
    res.json({ error: error.message });
  }
});

adminRouter.post("/adminlogin", async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: req.body.email });

    if (!admin || admin.password !== req.body.password) {
      return res.render("admin/admin_login", { msg: "Invalid Entry" });
    }

    req.session.admin = admin; // set the admin object to the session
    res.redirect("/admin"); // redirect to the admin panel
  } catch (error) {
    res.render("admin/admin_login", { msg: "Wrong Details" });
  }
});

adminRouter.get("/adminlogout", (req, res) => {
  req.session.admin = null;
  res.render("admin/admin_login", {
    title: "Admin Login",
    msg: "Logout Successfully",
  });
});

// Add product route// Add product route
adminRouter.get(
  "/admin/users",
  adminLoginVerify,
  adminController.renderUsersPage
);
// Add product route
adminRouter.get(
  "/admin/category",
  adminLoginVerify,
  adminController.renderCategoryPage
);
// Add product route// Add product route
adminRouter.get(
  "/admin/products",
  adminLoginVerify,
  adminController.renderProductsPage
);
adminRouter.get(
  "/admin/orders",
  adminLoginVerify,
  orderController.renderAdminOrderTable
);
adminRouter.post(
  "/admin/order/update/:orderId",
  adminLoginVerify,
  orderController.adminEditOrder
);
adminRouter.get(
  "/admin/order/delete/:orderId",
  adminLoginVerify,
  orderController.adminDeleteOrder
);
adminRouter.get(
  "/admin/sales-report",
  adminLoginVerify,
  salesController.rendersalesReportTable
);
adminRouter.post(
  "/admin/sales-report",
  adminLoginVerify,
  salesController.rendersalesReportTable
);
adminRouter.get(
  "/admin/graphdata/daily-orders",
  adminLoginVerify,
  chartController.generateDailyOrdersChart
);
adminRouter.get(
  "/admin/graphdata/weekly-sales",
  adminLoginVerify,
  chartController.generateWeeklySalesChart
);
adminRouter.get(
  "/admin/graphdata/order-status",
  adminLoginVerify,
  chartController.generateOrderStatusChart
);
adminRouter.get(
  "/admin/order/view/:id",
  adminLoginVerify,
  orderController.renderSingleOrderPage
); // Add product route
adminRouter.get(
  "/admin/coupons",
  adminLoginVerify,
  couponController.renderCouponPage
);
// Add coupon route
adminRouter.get(
  "/coupon/add",
  adminLoginVerify,
  couponController.renderAddCouponPage
);
adminRouter.post(
  "/coupon/add",
  adminLoginVerify,
  couponController.createCoupon
);

// Edit coupon route
adminRouter.get(
  "/coupon/edit/:id",
  adminLoginVerify,
  couponController.editCoupon
);
// Update coupon route
adminRouter.post("/coupon/update/:id", couponController.updateCoupon);

// Delete coupon route
adminRouter.get(
  "/coupon/delete/:id",
  adminLoginVerify,
  couponController.deleteCoupon
);

// Add Carousel with image upload
adminRouter.post(
  "/admin/carousel/add",
  upload.array("images"),
  adminLoginVerify,
  mediaController.addCarousel
);
adminRouter.get(
  "/carousel/add",

  adminLoginVerify,
  mediaController.renderAddCarouselForm
);

adminRouter.get(
  "/carousel/edit/:id",
  adminLoginVerify,
  mediaController.renderEditCarouselForm
);
adminRouter.get(
  "/admin/carousel_table",
  adminLoginVerify,
  mediaController.renderCarouselTable
);

adminRouter.get(
  "/carousel/:id",
  adminLoginVerify,
  mediaController.getCarouselById
);
adminRouter.post(
  "/admin/carousel/update/:id",
  adminLoginVerify,
  mediaController.updateCarousel
);
adminRouter.get(
  "/carousel/delete/:id",
  adminLoginVerify,
  mediaController.deleteCarousel
);

module.exports = adminRouter;
