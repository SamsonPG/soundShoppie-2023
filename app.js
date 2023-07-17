const express = require("express");
const nocache = require("nocache");
const session = require("express-session");
const path = require("path");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
const adminRouter = require("./routes/admin");
const userRouter = require("./routes/user");
const landingRouter = require("./routes/landing");
const PORT = process.env.PORT || 4000;
const Category = require("./models/category");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const User = require("./models/users");
const { generateSitemap } = require("seo-sitemap-generator");
const {
  clearCartAndMoveToWishlist,
} = require("./controller/clearCartController");
// const twilioRouter = require('./routes/twilio-sms')

const jsonParser = bodyParser.json();
app.use(jsonParser);
// app.use('/twilio-sms',twilioRouter)

// Helper function to get the category name from ID
app.locals.getCategoryName = async (categoryId) => {
  try {
    const category = await Category.findById(categoryId);
    return category.name;
  } catch (error) {
    // Handle the error appropriately
  }
};

dotenv.config(); // Load environment variables from .env file
app.use(nocache());
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

// Session middleware should be defined before the router middleware
app.use(
  session({
    secret: uuidv4(),
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 600000 },
  })
);

// Load static assets
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/partials", express.static(path.join(__dirname, "views/partials")));
app.use("/uploads", express.static("uploads"));

app.use("/", userRouter);
app.use("/", adminRouter);
app.use("/", landingRouter);
app.use("/admin", adminRouter);

// Database connection
mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", (error) => {});
db.once("open", () => {});

app.use((req, res, next) => {
  res.locals.message = req.session.message;
  delete req.session.message;
  next();
});

app.use((err, req, res, next) => {
  res.render("error", { error: err, request: req });
});

app.use("*", (req, res) => {
  res.render("error", { error: "", request: req });
});

cron.schedule("*/30 * * * *", () => {
  clearCartAndMoveToWishlist();
});

app.use(async (req, res, next) => {
  if (req.session.cookie.expires < Date.now()) {
    // Session cookie has expired
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }

      const userId = req.session.user._id;
      User.findOneAndUpdate(
        { _id: userId },
        { isLoggedIn: false },
        (err, userId) => {
          if (err) {
            return next(err);
          }

          if (!userId) {
            return res.redirect("/login.");
          }

          res.redirect("/login.");
        }
      );
    });
  } else {
    next();
  }
});
const urls = [
  "https://soundshoppie.de/",
  "https://soundshoppie.de/signupMobile",
  "https://soundshoppie.de/signup",
  "https://soundshoppie.de/login",
  "https://soundshoppie.de/landingPage",
  "https://soundshoppie.de/viewProducts",
  // Add more URLs as needed
];

// Route or middleware for serving the sitemap
app.get("/sitemap.xml", (req, res) => {
  const sitemap = generateSitemap(urls);
  res.header("Content-Type", "application/xml");
  res.send(sitemap);
});

app.listen(PORT, () => {
  console.log(`Server started at : http://localhost:${PORT}`);
});
