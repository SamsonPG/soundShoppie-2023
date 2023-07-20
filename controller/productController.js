const express = require("express");
const Product = require("../models/product");
const Category = require("../models/category");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const Order = require("../models/order");
const Cart = require("../models/cart");
// const { refreshUserSession } = require("../routes/user");
const productRouter = express.Router();
// Configure multer storage and destination
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Define the destination directory for uploaded files
    const uploadDir = "uploads/product";
    fs.mkdirSync(uploadDir, { recursive: true }); // Create the directory if it doesn't exist
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Define the filename for uploaded files
    cb(null, file.originalname);
  },
});

// Create multer instance
const upload = multer({ storage: storage });

// Configure sharp options for image resizing and quality
const sharpOptions = {
  fit: sharp.fit.inside,
  withoutEnlargement: true,
  quality: 90, // Adjust the quality value as needed (0-100)
  compressionLevel: 9, // Adjust the compression level as needed (0-9)
  png: {
    quality: 90, // Adjust the PNG quality value as needed (0-100)
    compressionLevel: 9, // Adjust the PNG compression level as needed (0-9)
  },
};

// Function to get the category name from ID

async function getCategories() {
  try {
    const categories = await Category.find({});
    return categories;
  } catch (error) {
    throw error;
  }
}

// Define the validateAddProductForm function
function validateAddProductForm(formData) {
  const errors = {};

  // Perform validation checks on the formData
  if (!formData.title || formData.title.trim() === "") {
    errors.title = "Title is required";
  }

  if (!formData.categoryId || formData.categoryId.trim() === "") {
    errors.categoryId = "Category is required";
  }

  if (!formData.price || isNaN(parseFloat(formData.price))) {
    errors.price = "Price must be a valid number";
  }

  if (!formData.description || formData.description.trim() === "") {
    errors.description = "Description is required";
  }

  if (!formData.stock || isNaN(parseInt(formData.stock))) {
    errors.stock = "Stock must be a valid number";
  }

  return errors;
}

const addProduct = async (req, res) => {
  try {
    const { title, categoryId, price, offerprice, description, stock, status } =
      req.body;

    // Validate form data
    const errors = validateAddProductForm(req.body);
    if (Object.keys(errors).length > 0) {
      req.session.message = {
        type: "danger",
        message: "Please correct the errors in the form",
        errors: errors,
      };
      return res.redirect("/admin/addProduct");
    }

    // Validate category ID
    let category;
    try {
      category = await Category.findById(categoryId);
    } catch (error) {
      req.session.message = {
        type: "danger",
        message: "Invalid category selected",
      };
      return res.redirect("/admin/addProduct");
    }

    if (!category) {
      req.session.message = {
        type: "danger",
        message: "Invalid category selected",
      };
      return res.redirect("/admin/addProduct");
    }

    const product = new Product({
      title,
      category: categoryId, // Assign the categoryId instead of the category name
      price,
      offerprice,
      status,
      description,
      stock,
    });

    // Check if there are any uploaded files
    if (req.files && req.files.length > 0) {
      const images = [];

      for (const file of req.files) {
        // Generate thumbnail from the uploaded image
        const thumbnailBuffer = await sharp(file.path)
          .resize(535, 400, { fit: "cover" })
          .jpeg(sharpOptions) // Specify the options for JPEG format
          .png(sharpOptions.png) // Specify the options for PNG format
          .toBuffer();

        // Save the thumbnail with a different filename
        const thumbnailFilename = `${Date.now()}-thumbnail${path.extname(
          file.originalname
        )}`;
        const thumbnailPath = path.join(
          "uploads",
          "product",
          thumbnailFilename
        );
        await sharp(thumbnailBuffer).toFile(thumbnailPath);

        // Push the thumbnail filename to the images array
        images.push(thumbnailFilename);

        // Delete the temporary uploaded file
        fs.unlinkSync(file.path);
      }

      // Assign the images array to the product object
      product.images = images;
    }

    await product.save();

    req.session.message = {
      type: "success",
      message: "Product added successfully!",
    };
    res.redirect("/admin/products");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    return res.redirect("/admin/products");
  }
};

//render add product page
const renderAddProductPage = async (req, res) => {
  try {
    const categories = await Category.find({}).lean().exec();

    if (req.session.admin) {
      res.render("admin/add_Product", {
        title: "Add Product",
        categories,
        categoryError: null,
        message: req.session.message,
      });
    } else {
      res.render("admin/admin_login", { title: "Admin Login" });
    }
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/products");
  }
};

//edit product

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id);

    if (!product) {
      req.session.message = {
        type: "danger",
        message: "Product not found!",
      };
      return res.redirect("/admin/products");
    }

    // Fetch categories
    const categories = await getCategories();

    res.render("admin/edit_product", {
      title: "Edit Product",
      product,
      message: req.session.message,
      categories, // Pass the categories variable to the template
    });
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/products");
  }
};

const updateProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id);

    if (!product) {
      req.session.message = {
        type: "danger",
        message: "Product not found!",
      };
      return res.redirect("/admin/products");
    }

    product.title = req.body.title;
    product.category = req.body.category;
    product.price = req.body.price;
    product.offerprice = req.body.offerprice;
    product.status = req.body.status;
    product.description = req.body.description;
    product.stock = req.body.stock;

    // Check if there are any uploaded files
    if (req.files && req.files.length > 0) {
      const images = [];

      for (const file of req.files) {
        // Generate thumbnail from the uploaded image
        const thumbnailBuffer = await sharp(file.path)
          .resize(600, 800, { fit: "cover" })
          .jpeg(sharpOptions) // Specify the options for JPEG format
          .png(sharpOptions.png) // Specify the options for PNG format
          .toBuffer();

        // Save the thumbnail with a different filename
        const thumbnailFilename = `${Date.now()}-thumbnail-${
          file.originalname
        }`;
        const thumbnailPath = path.join(
          "uploads",
          "product",
          thumbnailFilename
        );
        await sharp(thumbnailBuffer).toFile(thumbnailPath);

        // Push the thumbnail filename to the images array
        images.push(thumbnailFilename);

        // Delete the temporary uploaded file
        fs.unlinkSync(file.path);
      }

      // Assign the images array to the product object
      product.images = images;
    }

    await product.save();

    req.session.message = {
      type: "success",
      message: "Product updated successfully!",
    };
    res.redirect("/admin/products");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/products");
  }
};

const deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id);
    product.view = "blocked";
    await product.save();
    if (!product) {
      req.session.message = {
        type: "danger",
        message: "Product not found!",
      };
      return res.redirect("/admin/products");
    }

    // Check if the product is in any user's order
    const orders = await Order.find({ "cart.products.product": product._id });
    // const deliveredDate = await Order.findById(deliveredTimestamp);

    if (orders.length > 0 && orders.deliveredTimestamp !== null) {
      const orderIds = orders.map((order) => order._id);

      req.session.message = {
        type: "warning",
        message: `The product '${
          product.title
        }' is in the following order(s): ${orderIds.join(", ")}`,
      };
      return res.redirect("/admin/products");
    } else {
      // Delete the product's thumbnail files
      for (const image of product.images) {
        const thumbnailPath = path.join("uploads", "product", image);
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }

      await product.deleteOne();

      req.session.message = {
        type: "info",
        message: "Product deleted successfully!",
      };
      res.redirect("/admin/products");
    }
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/products");
  }
};

// Serve the product's image
productRouter.get("/productimage/:image", (req, res) => {
  const image = req.params.image;
  const imagePath = path.join(__dirname, "..", "uploads", "product", image);
  res.sendFile(imagePath);
});

// Block product
const blockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      req.session.message = {
        type: "danger",
        message: "Product not found",
      };
      return res.redirect("/admin/products");
    }

    product.view = "blocked";
    await product.save();

    req.session.message = {
      type: "success",
      message: "Product blocked successfully",
    };
    return res.redirect("/admin/products");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    return res.redirect("/admin/products");
  }
};

// Unblock product
const unblockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      req.session.message = {
        type: "danger",
        message: "Product not found",
      };
      return res.redirect("/admin/products");
    }

    product.view = "unblocked";
    await product.save();

    req.session.message = {
      type: "success",
      message: "Product unblocked successfully",
    };
    return res.redirect("/admin/products");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    return res.redirect("/admin/products");
  }
};

const renderProductPage = async (req, res) => {
  try {
    if (req.session.user && req.session.user.access !== "blocked") {
      const productId = req.params.id;
      const categories = await Category.find({}).lean().exec();
      const product = await Product.findById(productId).lean().exec();
      const products = await Product.find({}).exec();

      if (!product) {
        req.session.message = {
          type: "danger",
          message: "Product not found",
        };
        return res.redirect("/user/viewProducts");
      }

      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId });

      res.render("user/productPage", {
        title: "Product Details",
        products,
        product,
        categories,
        user: req.session.user,
        message: req.session.message,
        cart: cart,
      });
    } else {
      const productId = req.params.id;
      const categories = await Category.find({}).lean().exec();
      const product = await Product.findById(productId).lean().exec();
      const products = await Product.find({}).exec();

      if (!product) {
        req.session.message = {
          type: "danger",
          message: "Product not found",
        };
        return res.redirect("/user/viewProducts");
      }

      res.render("user/productPage", {
        title: "Product Details",
        products,
        product,
        categories,
        message: req.session.message,
      });
    }
  } catch (error) {
    res.render("error", { error: "An error occurred.", title: "Error Page" });
  }
};

const viewProductsPage = async (req, res) => {
  try {
    let products;
    let categories;
    let selectedCategory;

    if (req.session.user && req.session.user.access !== "blocked") {
      // await refreshUserSession(req, res, next);
      products = await Product.find({ view: "unblocked" }); // Get unblocked products
      selectedCategory = req.query.categoryId || ""; // Get the selected category ID from the request query parameter
      categories = await Category.find(); // Fetch categories from the database
      const categoryTitle = "Landing";
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId });

      res.render("user/viewProducts", {
        title: "View Products",
        title2: categoryTitle,
        products,
        categories,
        user: req.session.user,
        message: req.session.message,
        cart,
        selectedCategory, // Pass the selected category to the view
      });
    } else {
      products = await Product.find({ view: "unblocked" }); // Get unblocked products
      selectedCategory = req.query.categoryId || ""; // Get the selected category ID from the request query parameter
      categories = await Category.find(); // Fetch categories from the database
      const categoryTitle = "Landing";
      res.render("user/viewProducts", {
        title: "View Products",
        title2: categoryTitle,
        products,
        categories,
        message: req.session.message,
        selectedCategory, // Pass the selected category to the view
      });
    }
  } catch (error) {
    res.render("error", { error: "An error occurred.", title: "Error Page" });
  }
};

const displayProductsByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const category = await Category.findById(categoryId).lean().exec();
    const categories = await Category.find().lean().exec();

    if (!category) {
      return res.render("error", {
        error: "Category not found.",
        title: "Error Page",
      });
    }

    const categoryName = category.name;

    let products = [];

    if (categoryId) {
      // Fetch products based on the selected category
      products = await Product.find({ category: categoryId }).lean().exec();
    }

    // Filter out blocked products
    const filteredProducts = products.filter(
      (product) => product.view === "unblocked"
    );

    if (req.session.user && req.session.user.access !== "blocked") {
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId });
      const categoryTitle = "Category Page";
      res.render("user/viewProducts", {
        title: "View Products",
        title2: categoryTitle,
        products: filteredProducts,
        category,
        categories,
        categoryName,
        message: req.session.message,
        user: req.session.user,
        cart: cart,
      });
    } else {
      const categoryTitle = "Category Page";
      res.render("user/viewProducts", {
        title: "View Products",
        title2: categoryTitle,
        products: filteredProducts,
        category,
        categories,
        categoryName,
        message: req.session.message,
      });
    }
  } catch (error) {
    res.render("error", { error: "An error occurred.", title: "Error Page" });
  }
};

const displayProductsByPrice = async (req, res) => {
  try {
    const { sortBy } = req.query;

    let products;
    const categoryTitle = "Sort By Price Page";
    const categories = await Category.find();

    if (req.session.user && req.session.user.access !== "blocked") {
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId });

      if (sortBy === "high-to-low") {
        products = await getProductsByPriceDescending();
      } else if (sortBy === "low-to-high") {
        products = await getProductsByPriceAscending();
      }

      res.render("user/viewProducts", {
        title: "View Products",
        title2: categoryTitle,
        products,
        categories,
        sortBy,
        user: req.session.user,
        message: req.session.message,
        cart: cart,
      });
    } else {
      if (sortBy === "high-to-low") {
        products = await getProductsByPriceDescending();
      } else {
        products = await getProductsByPriceAscending();
      }

      res.render("user/viewProducts", {
        title: "View Products",
        title2: categoryTitle,
        products,
        categories,
        sortBy,
        message: req.session.message,
      });
    }
  } catch (error) {
    res.render("error", { error: "An error occurred.", title: "Error Page" });
  }
};

const getProductsByPriceDescending = async () => {
  return Product.find({ view: "unblocked" })
    .sort({ price: -1 })
    .populate("category");
};

const getProductsByPriceAscending = async () => {
  return Product.find({ view: "unblocked" })
    .sort({ price: 1 })
    .populate("category");
};

const displayProductsByPriceRange = async (req, res) => {
  try {
    const { sortBy, minPrice, maxPrice } = req.query;

    let products;
    const categoryTitle = "Sort By Price Range";
    const categories = await Category.find();

    if (req.session.user && req.session.user.access !== "blocked") {
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId });

      if (sortBy === "high-to-low") {
        products = await getProductsByPriceDescending(minPrice, maxPrice);
      } else if (sortBy === "low-to-high") {
        products = await getProductsByPriceAscending(minPrice, maxPrice);
      }

      res.render("user/viewProducts", {
        title: "View Products",
        title2: categoryTitle,
        products,
        categories,
        user: req.session.user,
        message: req.session.message,
        cart: cart,
        sortBy,
        minPrice,
        maxPrice,
      });
    } else {
      if (sortBy === "high-to-low") {
        products = await getProductsByPriceDescendingRange(minPrice, maxPrice);
      } else {
        products = await getProductsByPriceAscendingRange(minPrice, maxPrice);
      }

      res.render("user/viewProducts", {
        title: "View Products",
        title2: categoryTitle,
        products,
        categories,
        sortBy,
        minPrice,
        maxPrice,
        message: req.session.message,
      });
    }
  } catch (error) {
    res.render("error", { error: "An error occurred.", title: "Error Page" });
  }
};

const getProductsByPriceDescendingRange = async (minPrice, maxPrice) => {
  return Product.find({
    view: "unblocked",
    price: { $gte: minPrice, $lte: maxPrice },
  })
    .sort({ price: -1 })
    .populate("category");
};

const getProductsByPriceAscendingRange = async (minPrice, maxPrice) => {
  return Product.find({
    view: "unblocked",
    price: { $gte: minPrice, $lte: maxPrice },
  })
    .sort({ price: 1 })
    .populate("category");
};

const displayProductsByName = async (req, res) => {
  try {
    const categoryTitle = "Alphabetical Sorting";
    const categories = await Category.find();

    if (req.session.user && req.session.user.access !== "blocked") {
      const { sortBy } = req.query;
      const sortOption = sortBy === "z-to-a" ? -1 : 1;
      const products = await Product.find({ view: "unblocked" })
        .collation({ locale: "en", strength: 2 }) // Enable case-insensitive sorting
        .sort({ title: sortOption })
        .populate("category")
        .lean();

      // const category = await Category.find().lean();
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId }).lean();
      res.render("user/viewProducts", {
        title: "View Products",
        title2: categoryTitle,
        products,
        categories,
        sortBy,
        user: req.session.user,
        message: req.session.message,
        cart: cart,
      });
    } else {
      const { sortBy } = req.query;
      const sortOption = sortBy === "z-to-a" ? -1 : 1;
      const products = await Product.find({ view: "unblocked" })
        .collation({ locale: "en", strength: 2 }) // Enable case-insensitive sorting
        .sort({ title: sortOption })
        .populate("category")
        .lean();

      const categoryTitle = "Alphabetical Sorting";
      // const category = await Category.find().lean();
      res.render("user/viewProducts", {
        title: "View Products",
        title2: categoryTitle,
        products,
        categories,
        sortBy,
        message: req.session.message,
      });
    }
  } catch (error) {
    res.render("error", { error: "An error occurred.", title: "Error Page" });
  }
};

// Search route
const productSearch = async (req, res) => {
  try {
    const searchQuery = req.query.q;
    const products = await Product.find({
      title: { $regex: searchQuery, $options: "i" },
      view: "unblocked",
    }).exec();
    res.json(products);
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while searching products" });
  }
};

const getTotalProductCount = async () => {
  try {
    const count = await Product.countDocuments({ view: "unblocked" });

    return count;
  } catch (error) {
    // Handle any errors that occur during the counting process
    throw error;
  }
};

const paginationgetProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8; // Set the limit to 8 to display 8 products per page

    const totalProductCount = await getTotalProductCount();
    const totalPages = Math.ceil(totalProductCount / limit);

    let startIndex = (page - 1) * limit;

    // Adjust startIndex for the last page if it exceeds the totalProductCount
    if (startIndex >= totalProductCount) {
      startIndex = Math.max(0, totalProductCount - limit);
    }

    const products = await Product.find({ view: "unblocked" })
      .skip(startIndex)
      .limit(limit);

    return products; // Return the products array instead of sending a JSON response
  } catch (error) {
    // Handle any errors that occur during the pagination process
    throw error;
  }
};

module.exports = {
  addProduct,
  renderAddProductPage,
  editProduct,
  updateProduct,
  deleteProduct,
  productRouter,
  blockProduct,
  unblockProduct,
  renderProductPage,
  paginationgetProducts,
  getTotalProductCount,
  displayProductsByCategory,
  viewProductsPage,
  displayProductsByPrice,
  displayProductsByName,
  productSearch,
  displayProductsByPriceRange,
};
