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
const Wallet = require("../models/wallet");
const Coupons = require("../models/coupon");
class CartItem {
  constructor(product, quantity) {
    this.product = product;
    this.quantity = quantity;
  }
}

const renderCartPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    const userName = user.name;
    // Check if the user has a wallet
    let wallet = await Wallet.findOne({
      owner: userId,
      userName: userName,
    });
    if (!wallet) {
      wallet = await Wallet.create({
        owner: userId,
        userName: userName,
      });
    }

    // Fetch the cart and populate the products
    let cart = await Cart.findOne({ user: userId }).populate({
      path: "products.product",
      options: { strictPopulate: false },
    });
    if (!cart) {
      // If no cart exists, create a new cart
      cart = new Cart({
        user: userId,
        products: [],
        totalAmount: 0, // Initialize totalAmount to 0
      });
    }

    // Check if the 'cart.coupon' object exists before accessing the 'code' property
    const couponCode = cart.coupon ? cart.coupon.code : null;

    const cartLength = cart ? cart.products.length : 0; // Calculate cart length

    let totalAmount = calculateTotal(cart.products); // Calculate original total amount

    // Retrieve active coupons with discount <= totalAmount/2
    let eligibleCoupons = [];
    if (!couponCode) {
      eligibleCoupons = await couponsforCart(userId, totalAmount);
    }

    // Apply the coupon discount if a coupon is applied

    // Function to calculate the wallet amount to be deducted
    const calculateWalletAmount = (totalAmount, walletBalance) => {
      const walletPercentage = 0.5; // 50% of the total amount

      // Calculate the maximum wallet amount that can be deducted
      const maxWalletAmount = totalAmount * walletPercentage;

      // Check if the wallet balance is sufficient for the deduction
      if (walletBalance >= maxWalletAmount) {
        return maxWalletAmount;
      } else {
        return walletBalance; // Deduct the entire wallet balance if it's less than the maximum amount
      }
    };

    const walletBalance = wallet ? wallet.balance : 0.0; // Get the wallet balance
    const walletAmount = calculateWalletAmount(totalAmount, walletBalance); // Calculate the wallet amount to be deducted
    const newWalletBalance = wallet.balance - walletAmount;
    let deductedTotalAmount = totalAmount - walletAmount; // Calculate the new deducted total amount

    if (couponCode) {
      const couponDiscount = cart.coupon ? cart.coupon.discount : 0.0;
      totalAmount -= couponDiscount;
      deductedTotalAmount = totalAmount - walletAmount;
    }

    res.render("user/cart", {
      cart: cart,
      cartLength: cartLength,
      coupon: cart.coupon,
      totalAmount: totalAmount,
      deductedTotalAmount: deductedTotalAmount, // Pass the new deducted total amount to the view

      user: req.session.user,
      wallet: wallet,
      walletAmount: walletAmount,
      newWalletBalance: newWalletBalance,
      eligibleCoupons: eligibleCoupons,
      message: req.query.message,
      title: "User Cart",
    });
  } catch (error) {
    res.redirect("/error");
  }
};

const couponsforCart = async (userId, totalAmount) => {
  try {
    const currentDate = new Date();

    // Retrieve active coupons with discount <= totalAmount/2
    const coupons = await Coupons.find({
      status: "active",
      discount: { $lte: (totalAmount / 2).toString() },
      startingDate: { $lte: currentDate },
      expiryDate: { $gte: currentDate },
    });

    // Get the user to access the coupon field
    const user = await User.findById(userId);

    // Filter out coupons that have been used by the user
    const filteredCoupons = coupons.filter(
      (coupon) => !user.coupon.includes(coupon.code)
    );

    // Map each filtered coupon to include its color
    const couponsWithColor = filteredCoupons.map((coupon) => {
      const couponAmount = parseInt(coupon.discount);
      const color = getRandomColor(couponAmount);
      return { coupon, color };
    });

    return couponsWithColor;
  } catch (error) {
    throw error;
  }
};

function getRandomColor(couponAmount) {
  const colorRanges = [
    { range: [0, 428], color: "#ff0000" }, // Red

    { range: [429, 856], color: "#ff4500" }, // Orange
    { range: [857, 1284], color: "#800080" }, // Purple
    { range: [1285, 1712], color: "#008080" }, // Teal
    { range: [1713, 2140], color: "#ffa500" }, // Orange
    { range: [2141, 2568], color: "#008000" }, // Dark Green
    { range: [2569, 2997], color: "#800000" }, // Maroon
  ];

  let color = "#c9bc43"; // Default color if no matching range is found

  for (let i = 0; i < colorRanges.length; i++) {
    const { range, color: rangeColor } = colorRanges[i];
    const [min, max] = range;

    if (couponAmount >= min && couponAmount <= max) {
      color = rangeColor;
      break;
    }
  }

  return color;
}

const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const couponCode = req.body.couponCode;

    // Retrieve the user
    const user = await User.findById(userId);

    // Retrieve the cart
    const cart = await Cart.findOne({ user: userId });

    // Retrieve the available coupons for the user's cart
    const availableCoupons = await couponsforCart(userId, cart.totalAmount);

    // Check if the entered coupon code is valid
    const validCoupon = availableCoupons.find(
      (coupon) => coupon.coupon.code === couponCode
    );

    if (!validCoupon) {
      // Coupon code is not valid for the user's cart
      return res.redirect("/cart?message=Coupon%20already%20applied"); // Redirect to cart with an error message as query parameter
    }

    // Update the user's coupon field
    user.coupon.push(couponCode);
    await user.save();

    // Update the cart's coupon field
    cart.coupon.code = couponCode;
    cart.coupon.discount = validCoupon.coupon.discount;

    // Save the updated cart
    await cart.save();

    return res.redirect("/cart?message=Coupon%20applied");
  } catch (error) {
    return res.redirect("/cart?message=An%20Error%20Occurred");
  }
};

const calculateFinalPrice = (product) => {
  let finalprice = 0;
  if (
    product.category &&
    product.category.offerpercentage > 0 &&
    product.category.status === "active"
  ) {
    if (product.offerprice > 0 && product.status === "active") {
      finalprice =
        product.price -
        (product.price * product.category.offerpercentage) / 100 -
        product.offerprice;
    } else {
      finalprice =
        product.price -
        (product.price * product.category.offerpercentage) / 100;
    }
  } else if (product.offerprice > 0 && product.status === "active") {
    finalprice = product.price - product.offerprice;
  } else {
    finalprice = product.price;
  }
  return finalprice;
};

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const productId = req.params.id;

    const user = await User.findOne({ _id: userId });
    const product = await Product.findOne({ _id: productId }).populate(
      "category"
    );

    if (!product) {
      throw new Error("Product not found");
    }

    // Check if the product is out of stock
    if (product.stock === 0) {
      throw new Error("Product is out of stock");
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      // If no cart exists, create a new cart
      cart = new Cart({
        user: userId,
        products: [],
        totalAmount: 0,
      });
    }

    // Check if the product already exists in the cart
    const existingProduct = cart.products.find(
      (p) => p.product.toString() === productId
    );

    if (existingProduct) {
      // If the product already exists, increase its quantity by 1
      existingProduct.quantity += 1;
    } else {
      // If the product doesn't exist, add it to the cart with a quantity of 1
      const finalPrice = calculateFinalPrice(product);

      cart.products.push({
        product: productId,
        quantity: 1,
        finalprice: finalPrice,
      });
    }

    // Calculate the new total amount
    let totalAmount = 0;
    for (const item of cart.products) {
      const itemProduct = await Product.findOne({ _id: item.product });
      if (itemProduct) {
        const price = item.finalprice > 0 ? item.finalprice : itemProduct.price;
        totalAmount += price * item.quantity;
      }
    }
    cart.totalAmount = totalAmount;

    // Decrement the product's stock count
    product.stock -= 1;

    // Save the updated cart and product
    await Promise.all([cart.save(), product.save()]);

    res.redirect("/cart");
  } catch (error) {
    res
      .status(500)
      .send("An error occurred while adding the product to the cart");
  }
};

const incrementCartItem = async (req, res) => {
  try {
    const itemId = req.params.itemId;

    // Find the cart item in the database and increment the quantity
    const cart = await Cart.findOne({ "products._id": itemId });
    if (!cart) {
      return res.redirect("/cart");
    }

    const cartItem = cart.products.find((p) => p._id.toString() === itemId);
    if (!cartItem) {
      return res.redirect("/cart");
    }

    const product = await Product.findOne({ _id: cartItem.product });
    if (product.stock > 0) {
      cartItem.quantity += 1;
      product.stock -= 1;
    }

    // Calculate the new total amount
    let totalAmount = 0;
    for (const item of cart.products) {
      const itemProduct = await Product.findOne({ _id: item.product });

      const price = item.finalprice > 0 ? item.finalprice : itemProduct.price;
      totalAmount += price * item.quantity;
    }
    cart.totalAmount = totalAmount;

    // Save the updated cart and product
    await Promise.all([cart.save(), product.save()]);

    res.redirect("/cart");
  } catch (error) {
    res.redirect("/cart");
  }
};

const decrementCartItem = async (req, res) => {
  try {
    const itemId = req.params.itemId;

    // Find the cart item in the database and decrement the quantity
    const cart = await Cart.findOne({ "products._id": itemId });
    if (!cart) {
      return res.redirect("/cart");
    }

    const cartItem = cart.products.find((p) => p._id.toString() === itemId);
    if (!cartItem) {
      return res.redirect("/cart");
    }

    const product = await Product.findOne({ _id: cartItem.product });
    cartItem.quantity -= 1;
    product.stock += 1;
    if (cartItem.quantity === 0) {
      // Remove the item from the cart if quantity becomes 0
      cart.products.pull({ _id: itemId });
    }

    // Calculate the new total amount
    let totalAmount = 0;
    for (const item of cart.products) {
      const itemProduct = await Product.findOne({ _id: item.product });

      const price = item.finalprice > 0 ? item.finalprice : itemProduct.price;
      totalAmount += price * item.quantity;
    }
    cart.totalAmount = totalAmount;

    // Save the updated cart and product
    await Promise.all([cart.save(), product.save()]);

    res.redirect("/cart");
  } catch (error) {
    res.redirect("/cart");
  }
};

const deleteCartItem = async (req, res) => {
  try {
    const itemId = req.params.itemId;

    // Find and remove the cart item from the database
    const cart = await Cart.findOne({ "products._id": itemId });
    if (!cart) {
      return res.redirect("/cart");
    }

    const cartItem = cart.products.find((p) => p._id.toString() === itemId);
    if (!cartItem) {
      return res.redirect("/cart");
    }

    const product = await Product.findOne({ _id: cartItem.product });
    product.stock += cartItem.quantity;

    cart.products.pull({ _id: itemId });

    // Calculate the new total amount
    let totalAmount = 0;
    for (const item of cart.products) {
      const itemProduct = await Product.findOne({ _id: item.product });

      // const price = item.finalprice > 0 ? item.finalprice : itemProduct.price;
      totalAmount += itemProduct.price * item.quantity;
    }
    cart.totalAmount = totalAmount;

    // Save the updated cart and product
    await Promise.all([cart.save(), product.save()]);

    res.redirect("/cart");
  } catch (error) {
    res.redirect("/cart");
  }
};

module.exports = {
  renderCartPage,
  addToCart,
  incrementCartItem,
  decrementCartItem,
  deleteCartItem,
  CartItem,
  applyCoupon,
};
