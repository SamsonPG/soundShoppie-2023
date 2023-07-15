const Cart = require("../models/cart");
const User = require("../models/users");
const Product = require("../models/product");

const Wishlist = require("../models/wishlist");

const renderWishlistPage = async (req, res) => {
  try {
    const userId = req.session.user._id;

    // Fetch the cart and populate the products
    let wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: "products.product",
      options: { strictPopulate: false },
    });
    if (!wishlist) {
      wishlist = { products: [] }; // Create a temporary cart object if no cart is found
    }

    const wishlistLength = wishlist ? wishlist.products.length : 0; // Calculate cart length

    const cart = await Cart.findOne({ user: userId });
    res.render("user/wishlist", {
      wishlist: wishlist,
      wishlistLength: wishlistLength,

      cart: cart,
      user: req.session.user,

      message: req.query.message,
      product: wishlist ? wishlist.products.map((p) => p.product) : [], // pass the products to the template});
    });
  } catch (error) {
    res.redirect("/error");
  }
};
const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const productId = req.params.id;

    const user = await User.findOne({ _id: userId });
    const product = await Product.findOne({ _id: productId });

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!product) {
      throw new Error("Product not found");
    }

    // If no cart exists, create a new cart
    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        products: [],
      });
    }

    // Check if the product already exists in the cart
    const existingProductIndex = wishlist.products.findIndex(
      (p) => p.product.toString() === productId
    );

    if (existingProductIndex === -1) {
      wishlist.products.push({
        product: productId,
      });
    }

    await wishlist.save();
    await product.save();
    res.redirect("/wishlist");
  } catch (error) {
    res
      .status(500)
      .send("An error occurred while adding the product to the wishlist");
  }
};

const deleteWishlistItem = async (req, res) => {
  try {
    const user = req.session.user._id;
    const index = req.params.index;

    // Find the user's wishlist
    const wishlist = await Wishlist.findOne({ user: user });

    if (!wishlist) {
      return res.redirect("/wishlist");
    }

    // Remove the product at the specified index
    const removedProduct = wishlist.products.splice(index, 1)[0];

    // Save the updated wishlist
    await wishlist.save();

    res.redirect("/wishlist");
  } catch (error) {
    res.redirect("/wishlist");
  }
};
module.exports = {
  renderWishlistPage,
  addToWishlist,
  deleteWishlistItem,
};
