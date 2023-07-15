const Cart = require("../models/cart");
const Wishlist = require("../models/wishlist");
const User = require("../models/users");
const Product = require("../models/product");
const express = require("express");
const userRouter = express.Router();
const session = require("express-session");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const app = express();

async function clearCartAndMoveToWishlist() {
  try {
    // Get all carts
    const carts = await Cart.find();

    // Iterate over each cart
    for (const cart of carts) {
      const cartCreationTime = cart.createdAt.getTime();
      const currentTime = Date.now();

      // Check if the cart has been stored for more than 1 hour (3600000 milliseconds)
      if (currentTime - cartCreationTime > 3600000) {
        // Find the user associated with the cart
        const user = await User.findById(cart.user);

        if (user) {
          // Check if the user is logged in
          if (!user.isLoggedIn) {
            // Move each product from cart to wishlist
            for (const item of cart.products) {
              const product = await Product.findById(item.product);

              if (product) {
                // Check if the product already exists in the wishlist
                const existingProduct = await Wishlist.findOne({
                  user: user._id,
                  "products.product": product._id,
                });

                if (!existingProduct) {
                  // If the product doesn't exist, add it to the wishlist
                  await Wishlist.findOneAndUpdate(
                    { user: user._id },
                    {
                      $push: {
                        products: {
                          product: product._id,
                        },
                      },
                    },
                    { upsert: true }
                  );
                }
                // Increment the stock of the product
                await Product.findByIdAndUpdate(product._id, {
                  $inc: { stock: item.quantity },
                });
              }
            }

            // Clear the cart
            await Cart.findByIdAndDelete(cart._id);
          }
        }
      }
    }
  } catch (error) {}
}

module.exports = { clearCartAndMoveToWishlist };
