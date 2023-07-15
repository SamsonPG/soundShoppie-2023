const express = require("express");
const userRouter = express.Router();
const User = require("../models/users");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const app = express();
const Product = require("../models/product");
const Category = require("../models/category");
const categoryController = require("../controller/categoryController");
const productController = require("../controller/productController");
const {
  sendOTP,
  verifyOTP,
  sendOTPSignup,
  verifyOTPSignup,
  sendOTPForgotPassword,
  verifyOTPForgotPassword,
  verifyChangePassword,
} = require("../controller/twilio-sms");
const bcrypt = require("bcrypt");
const Cart = require("../models/cart");
const Order = require("../models/order");
const cartController = require("../controller/cartController");
const userController = require("../controller/userController");
const orderController = require("../controller/orderController");
const wishlistController = require("../controller/wishlistController");
const razorpayController = require("../controller/razorpayController");
const userProfileController = require("../controller/userProfileController");
const Carousel = require("../models/carousel");
const {
  refreshUserSession,
  userLoginVerify,
} = require("../middlewares/middlewares");
const paypalController = require("../controller/paypalController");
// Apply the middleware to all routes
userRouter.use(refreshUserSession);

// Apply the refreshSession middleware to all routes except the "/admin" route
userRouter.use((req, res, next) => {
  if (req.path !== "/user") {
    return next();
  }
  refreshSession(req, res, next);
});

userRouter.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
      // Invalid credentials or user not found
      return res.render("user/login", {
        title: "Login",
        msg: "Invalid email or password",
      });
    }

    if (user.access === "blocked") {
      // User is blocked
      return res.render("user/login", {
        title: "Login",
        msg: "User is blocked",
      });
    }

    req.session.user = user;
    // set the user object to the session
    user.isLoggedIn = true;
    await user.save();
    res.redirect("/userHome"); // redirect to the user home page
  } catch (error) {
    res.render("user/login", { title: "Login", msg: "Wrong details" });
  }
});

// Configure multer storage and destination
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/user"); // Specify the folder where the uploaded files will be stored
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "image-" + uniqueSuffix + ".jpeg"); // Generate a unique filename for the uploaded file
  },
});

// Create multer instance
const upload = multer({ storage: storage });

// Serve the user's image
userRouter.get("/userimage/:image", (req, res) => {
  const image = req.params.image;
  const imagePath = path.join(__dirname, "..", "uploads", "user", image);
  res.sendFile(imagePath);
});

userRouter.get(
  "/userProfile",
  refreshUserSession,
  userLoginVerify,
  async (req, res) => {
    if (req.session.user && req.session.user.access !== "blocked") {
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId });
      res.render("user/userProfile", {
        title: "User Profile",
        user: req.session.user,
        message: req.session.message,
        cart: cart,
      });
    } else {
      res.render("user/signup", { title: "Sign Up" });
    }
  }
);

userRouter.get("/userlogout", refreshUserSession, async (req, res) => {
  if (req.session.user) {
    const userId = req.session.user._id;
    const user = await User.findOne({ _id: userId });
    if (user) {
      user.isLoggedIn = false;
      await user.save();
    }
  }
  req.session.user = null;
  const ITEMS_PER_PAGE = 8; // Number of items to display per page
  try {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const startIndex = (page - 1) * ITEMS_PER_PAGE;

    const totalProductCount = await productController.getTotalProductCount();
    const totalPages = Math.ceil(totalProductCount / ITEMS_PER_PAGE);

    const products = await productController.paginationgetProducts(req, res); // Pass the request and response objects

    const categories = await Category.find(); // Fetch categories from the database
    const carousel = await Carousel.findOne({ carouselstatus: "active" });
    res.render("user/landingPage", {
      title: "Landing Page",
      products,
      categories,
      page,
      totalPages,
      carousel: carousel,
    });
  } catch (error) {
    res.render("error", { error: "An error occurred." });
  }
});
userRouter.get("/signupMobile", refreshUserSession, (req, res) => {
  if (req.session.user && req.session.user.access !== "blocked") {
    // User session exists, redirect to userHome
    res.redirect("/userHome");
  } else {
    res.render("user/signupMobile", { title: "Sign Up" });
  }
});
userRouter.get("/signup.", refreshUserSession, (req, res) => {
  if (req.session.user && req.session.user.access !== "blocked") {
    // User session exists, redirect to userHome
    res.redirect("/userHome");
  } else {
    res.render("user/signup", { title: "Sign Up" });
  }
});

userRouter.get("/login.", refreshUserSession, (req, res) => {
  if (req.session.user && req.session.user.access !== "blocked") {
    // User session exists, redirect to userHome
    res.redirect("/userHome");
  } else {
    res.render("user/login", { title: "Login" });
  }
});

userRouter.get("/mobilelogin", refreshUserSession, (req, res) => {
  if (req.session.user && req.session.user.access !== "blocked") {
    // User session exists, redirect to userHome
    res.redirect("/userHome");
  } else {
    res.render("user/mobilelogin", { title: "Login" });
  }
});
userRouter.get("/loginForgotPassword", refreshUserSession, (req, res) => {
  if (req.session.user && req.session.user.access !== "blocked") {
    // User session exists, redirect to userHome
    res.redirect("/userHome");
  } else {
    res.render("user/loginForgotPassword", { title: "Forgot Password" });
  }
});
userRouter.post(
  "/sendOTP/forgotPassword",
  refreshUserSession,
  sendOTPForgotPassword
);
userRouter.post(
  "/verifyOTP/forgotPassword",
  refreshUserSession,
  verifyOTPForgotPassword
);
userRouter.post(
  "/otp/changePassword",
  refreshUserSession,

  verifyChangePassword
);
// send-otp
userRouter.post("/sendotp", sendOTP);

userRouter.post("/verifyOTP", verifyOTP);

userRouter.post(
  "/sendOTPSignup",
  refreshUserSession,
  upload.single("image"),
  sendOTPSignup
);
userRouter.post(
  "/verifyOTPSignup",
  refreshUserSession,
  upload.single("image"),

  verifyOTPSignup
);

// Add user from home signup

userRouter.post(
  "/homeadd",
  refreshUserSession,
  upload.single("image"),
  async (req, res) => {
    try {
      const existingUser = await User.findOne({ email: req.body.email });

      if (existingUser) {
        // User with the same email already exists
        return res.render("user/signup", {
          title: "Sign Up",
          msg: "Email Already Exists",
        });
      }

      const existingMobileUser = await User.findOne({
        mobile: req.body.mobile,
      });

      if (existingMobileUser) {
        // User with the same mobile number already exists
        return res.render("user/signup", {
          title: "Sign Up",
          msg: "Mobile Number Already Exists",
        });
      }

      if (req.session.user && req.session.user.access !== "blocked") {
        // An active user exists, redirect to userHome
        return res.redirect("/userHome");
      }
      const saltRounds = 10; // Number of salt rounds for bcrypt

      // Hash the password using bcrypt
      const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

      // Create a new user object with the hashed password
      const user = new User({
        name: req.body.name,
        email: req.body.email,
        mobile: req.body.mobile,
        password: hashedPassword,
      });

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
      }
      user.isLoggedIn = true;
      await user.save();

      // await user.save();
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
      res.render("user/userHome", {
        title: "User Home",
        image: thumbnailUrl,
        user: req.session.user,
        products,
        categories,
        page,
        totalPages,
        carousel: carousel,
        cart: cart,
      });
    } catch (error) {
      res.json({ msg: error.message, type: "danger" });
    }
  }
);

userRouter.get(
  "/userHome",
  refreshUserSession,
  userLoginVerify,
  async (req, res) => {
    try {
      if (req.session.user && req.session.user.access !== "blocked") {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 8;

        const totalProductCount =
          await productController.getTotalProductCount();
        const totalPages = Math.ceil(totalProductCount / limit);

        const products = await productController.paginationgetProducts(
          req,
          res
        );
        const categories = await Category.find(); // Fetch categories from the database

        // Pass the image filename or URL to the template
        const thumbnailUrl = req.session.user.image
          ? "/userimage/" + req.session.user.image
          : null;
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 8;

        const totalProductCount =
          await productController.getTotalProductCount();
        const totalPages = Math.ceil(totalProductCount / limit);

        const products = await productController.paginationgetProducts(
          req,
          res
        );
        const categories = await Category.find(); // Fetch categories from the database
        const carousel = await Carousel.findOne({ carouselstatus: "active" });
        // Pass the image filename or URL to the template
        const thumbnailUrl = req.session.user.image
          ? "/userimage/" + req.session.user.image
          : null;

        res.render("user/userHome", {
          title: "User Home",
          image: thumbnailUrl,
          user: req.session.user,
          products,
          categories,
          page,
          totalPages,
          carousel: carousel,
        });
      }
    } catch (error) {
      res.render("error", { error: "An error occurred." });
    }
  }
);

userRouter.get(
  "/productDetails/:id",

  productController.renderProductPage
);

userRouter.get("/viewproducts", productController.viewProductsPage);

userRouter.get(
  "/viewproducts/sortbyPrice",
  productController.displayProductsByPrice
);
userRouter.get(
  "/viewproducts/sortbyName",
  productController.displayProductsByName
);
userRouter.get(
  "/products/sortby/priceRange",

  productController.displayProductsByPriceRange
);
userRouter.get("/search", productController.productSearch);

userRouter.get(
  "/categoryDetails/:categoryId",
  productController.displayProductsByCategory
);

userRouter.get(
  "/cart",
  refreshUserSession,
  userLoginVerify,
  cartController.renderCartPage
);
userRouter.get(
  "/add-to-cart/:id",
  refreshUserSession,
  userLoginVerify,
  cartController.addToCart
);
userRouter.get(
  "/cart/increment/:itemId",
  refreshUserSession,
  userLoginVerify,
  cartController.incrementCartItem
);
userRouter.get(
  "/cart/decrement/:itemId",
  refreshUserSession,
  userLoginVerify,
  cartController.decrementCartItem
);
userRouter.get(
  "/cart/delete/:itemId",
  refreshUserSession,
  userLoginVerify,
  cartController.deleteCartItem
);

userRouter.get(
  "/user/address/:Id",
  refreshUserSession,
  userLoginVerify,
  userController.addressAdd
);
userRouter.post(
  "/user/profile/address/:Id",
  refreshUserSession,
  userLoginVerify,
  userProfileController.profileaddUserAddress
);
userRouter.post(
  "/user/address/:id",
  refreshUserSession,
  userLoginVerify,
  userController.addUserAddress
);
userRouter.get(
  "/user/checkOut/:Id",
  refreshUserSession,
  userLoginVerify,
  orderController.renderCheckOutPage
);
userRouter.get(
  "/user/buyNow/:productId",
  refreshUserSession,
  userLoginVerify,
  orderController.buyNow
);

userRouter.post(
  "/user/placeOrder/:Id",
  refreshUserSession,
  userLoginVerify,
  orderController.renderPlaceOrderPage
);
// Route for initiating the PayPal payment
userRouter.post(
  "/user/order/paypal/pay/:Id",
  refreshUserSession,
  userLoginVerify,
  paypalController.payWithPayPal
);

userRouter.get(
  "/success",
  refreshUserSession,
  userLoginVerify,
  async (req, res) => {
    try {
      const userId = req.session.user._id;
      const paymentStatus = req.query.paymentStatus || "success";

      // Find the last saved order for the user and update the payment status
      const updatedOrder = await Order.findOneAndUpdate(
        { user: userId },
        { $set: { paymentStatus } },
        { sort: { createdAt: -1 }, new: true }
      );

      if (!updatedOrder) {
        // Handle the case where the order is not found
        return res.render("error", { error: "Order not found" });
      }

      // Clear the cart for the user
      await Cart.findOneAndDelete({ user: userId });

      const cart = await Cart.findOne({ user: userId });
      res.render("user/orderSuccess", {
        user: req.session.user,
        msg: req.session.msg,
        cart: cart,
      });
    } catch (error) {
      // Handle the error and render an appropriate error page
      res.render("error", {
        error: "Failed to clear cart",
      });
    }
  }
);

// Add a new route for handling the cancel URL
userRouter.get(
  "/cancel",
  refreshUserSession,
  userLoginVerify,
  async (req, res, next) => {
    try {
      const userId = req.session.user._id;

      // Find the latest order for the user
      const order = await Order.findOne({ user: userId }).sort({
        createdAt: -1,
      });

      if (order) {
        // Delete the order
        await Order.findByIdAndDelete(order._id);
      } else {
      }

      const cart = await Cart.findOne({ user: userId });
      // Render the orderCancelled template
      res.render("user/orderCancelled", {
        user: req.session.user,
        msg: req.session.msg,

        cart: cart,
      });
    } catch (error) {
      res.redirect("/failed");
      next(error);
    }
  }
);

userRouter.get(
  "/failed",
  refreshUserSession,
  userLoginVerify,
  async (req, res) => {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId });
    res.render("user/orderFailed", {
      user: req.session.user,
      msg: req.session.msg,

      cart: cart,
    });
  }
);
// Route for initiating the Razorpay payment
userRouter.post(
  "/user/order/razorpay/pay/:Id",
  refreshUserSession,
  userLoginVerify,
  razorpayController.payWithRazorpay
);
userRouter.post(
  "/update-address/:id",
  refreshUserSession,
  userLoginVerify,
  userProfileController.updateUserAddress
);
userRouter.post(
  "/update-user-info/:id",
  refreshUserSession,
  userLoginVerify,
  userProfileController.updateUserInfo
);
userRouter.post(
  "/update-profile-picture/:id",
  refreshUserSession,
  userLoginVerify,
  upload.single("image"),
  userProfileController.updateProfilePicture
);
userRouter.post(
  "/change-password/:id",
  refreshUserSession,
  userLoginVerify,
  userProfileController.changePassword
);
userRouter.get(
  "/user/editProfile/:id",
  refreshUserSession,
  userLoginVerify,
  userProfileController.rendereditUserProfile
);
userRouter.get(
  "/user/oders/:id",
  refreshUserSession,
  userLoginVerify,
  userProfileController.renderUserOrder
);
userRouter.post(
  "/user/order/update/:orderId",
  refreshUserSession,
  userLoginVerify,
  orderController.userEditOrder
);
userRouter.get(
  "/user/order/view/:id",
  refreshUserSession,
  userLoginVerify,
  orderController.renderUserSingleOrderPage
);
userRouter.post(
  "/apply-coupon",
  refreshUserSession,
  userLoginVerify,
  cartController.applyCoupon
);
userRouter.get(
  "/wishlist",
  refreshUserSession,
  userLoginVerify,
  wishlistController.renderWishlistPage
);
userRouter.get(
  "/add-to-wishlist/:id",
  refreshUserSession,
  userLoginVerify,
  wishlistController.addToWishlist
);

userRouter.get(
  "/delete-wishlist-item/:index",
  refreshUserSession,
  userLoginVerify,
  wishlistController.deleteWishlistItem
);

module.exports = userRouter;
