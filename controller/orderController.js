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
const Wallet = require("../models/wallet");

const {
  refreshUserSession,
  userLoginVerify,
} = require("../middlewares/middlewares");

const renderCheckOutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    // Check if the user has a wallet
    let wallet = await Wallet.findOne({ owner: userId });

    if (!wallet) {
      // If the user doesn't have a wallet, create a new one
      wallet = await Wallet.create({ owner: userId });
    }

    // Find the user's cart
    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "products.product",
        options: { strictPopulate: false },
      })
      .exec();

    if (!cart) {
      throw new Error("Cart not found");
    }

    // Find the user's addresses
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    let totalAmount = calculateTotal(cart.products); // Calculate total amount
    const cartLength = cart ? cart.products.length : 0; // Calculate cart length
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

    const couponDiscount = cart.coupon ? cart.coupon.discount : 0.0;
    totalAmount -= couponDiscount;

    const deductedTotalAmount = totalAmount - walletAmount; // Calculate the new deducted total amount
    // Apply the coupon discount if a coupon is applied

    res.render("user/checkOut", {
      cart: cart,
      cartLength: cartLength,
      totalAmount: totalAmount,
      deductedTotalAmount: deductedTotalAmount,
      addresses: user.addresses,
      user: req.session.user,
      msg: req.session.message,
      addressIndex: user.addresses.index,
      wallet: wallet,
      walletAmount: walletAmount,
      newWalletBalance: newWalletBalance,
      title: "User Checkout",
    });
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: "An error occurred while rendering the checkout page",
    };
    res.redirect("/cart");
  }
};

const renderPlaceOrderPage = async (req, res, next) => {
  try {
    const userId = req.body.userId;
    const selectedAddressIndex = req.body.selectedAddressIndex;
    const selectedPaymentMethod = req.body.paymentMethod;
    const deductedTotalAmount = req.body.deductedTotalAmount;
    const walletAmount = req.body.walletAmount;
    const newWalletBalance = req.body.newWalletBalance;
    const paymentOption = req.body.paymentOption;

    // Find the user's cart
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      throw new Error("Cart not found");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    // Get the selected address from the user's addresses array
    const selectedAddress = user.addresses[selectedAddressIndex];
    // Create an array to hold the products in the cart
    const cartProducts = [];

    // Loop through the cart's products and populate the cartProducts array with the required data
    for (const productData of cart.products) {
      const product = await Product.findById(productData.product);
      if (!product) {
        throw new Error("Product not found");
      }

      const cartProduct = {
        product: product,
        quantity: productData.quantity,
        finalprice: productData.finalprice,
      };

      cartProducts.push(cartProduct);
    }

    // Calculate the total amount by iterating over the cartProducts array
    let totalAmount = 0;
    for (const cartProduct of cartProducts) {
      totalAmount +=
        cartProduct.finalprice > 0
          ? cartProduct.finalprice * cartProduct.quantity
          : cartProduct.product.price * cartProduct.quantity;
    }

    const couponDiscount = cart.coupon ? cart.coupon.discount : 0.0;
    let deductedTotalAmountCoupon = totalAmount;
    deductedTotalAmountCoupon -= couponDiscount;
    // Create a new order document
    const order = new Order({
      user: userId,
      userName: user.name,
      cart: {
        products: cartProducts,
        totalAmount: totalAmount,
        coupon: cart.coupon,
        walletAmount: paymentOption === "withoutWallet" ? 0 : walletAmount,
        deductedTotalAmount:
          paymentOption === "withoutWallet"
            ? deductedTotalAmountCoupon
            : deductedTotalAmount,
        newWalletBalance:
          paymentOption === "withoutWallet" ? 0 : newWalletBalance,
        paymentOption: paymentOption,
      },
      mobile: user.mobile,
      address: selectedAddress,
      orderStatus: "Processing",
      reason: "",
      paymentMethod: selectedPaymentMethod,
      paymentStatus: "success",
    });

    // Save the order to the database
    const savedOrder = await order.save();

    // Check if the user has a wallet
    if (paymentOption === "withWallet") {
      let wallet = await Wallet.findOne({ owner: userId });

      // Create a new transaction object
      const transaction = {
        order: savedOrder._id,
        walletUpdate: "walletNotCredited",
      };

      // Update the wallet balance and add the transaction to transactions
      wallet.balance = newWalletBalance;
      wallet.transactions.push(transaction);
      // await wallet.save();
      try {
        // Save the wallet
        const savedWallet = await wallet.save();
      } catch (error) {}
    }

    // Empty the cart
    cart.products = [];
    cart.totalAmount = 0;
    cart.coupon = {
      code: "",
      discount: 0.0,
    };
    await cart.save();

    res.render("user/orderSuccess", {
      user: req.session.user,
      msg: req.session.msg,
      title: "Order Success",
      cart: cart,
    }); // Redirect to a success page
  } catch (error) {
    res.redirect("/error"); // Redirect to an error page
  }
};

const renderAdminOrderTable = async (req, res, next) => {
  try {
    // Fetch all orders from the database and populate the 'cart.products.product' field
    const orders = await Order.find().populate("cart.products.product");

    // Filter out orders with paymentStatus "failed"
    const filteredOrders = orders.filter(
      (order) => order.paymentStatus !== "failed"
    );
    // Find orders with paymentStatus "failed"
    const failedOrders = orders.filter(
      (order) => order.paymentStatus === "failed"
    );

    // Delete failed orders and increment product stock
    for (const order of failedOrders) {
      await deleteOrder(order._id);
    }

    // Check orderStatus "Cancel" or "Return Approved" and increment stock count
    for (const order of orders) {
      if (
        (order.orderStatus === "Cancel" ||
          order.orderStatus === "Return Approved") &&
        order.backStockStatus === "notUploaded"
      ) {
        await stockUpdateReturnCancel(order._id);
      }
    }

    res.render("admin/orders_table", {
      title: "Admin Order Details",
      orders: orders.map((order) => {
        order.cart.products = order.cart.products.map((product) => {
          if (!product.product) {
            product.product = { title: "Product Removed" };
          }
          return product;
        });
        return order;
      }),
      admin: req.session.admin,
      message: req.session.message,
      order: filteredOrders,
    }); // Pass the orders data to the order table view
  } catch (error) {
    res.redirect("/error"); // Redirect to an error page
  }
};

const deleteOrder = async (orderId) => {
  try {
    // Find the order by its ID and populate the 'cart.products.product' field
    const order = await Order.findById(orderId).populate(
      "cart.products.product"
    );

    if (!order) {
      return;
    }

    // Check if the order has paymentStatus "failed"
    if (order.paymentStatus !== "failed") {
      return;
    }

    // Iterate over the products in the order and increment the stock
    for (const cartItem of order.cart.products) {
      const product = await Product.findById(cartItem.product);

      if (!product) {
        continue;
      }

      product.stock += cartItem.quantity;
      await product.save();
    }

    // Delete the order
    await Order.findByIdAndRemove(orderId);
  } catch (error) {}
};

const stockUpdateReturnCancel = async (orderId) => {
  try {
    const order = await Order.findById(orderId).populate(
      "cart.products.product"
    );
    if (!order) {
      return;
    }

    if (
      order.orderStatus !== "Cancel" &&
      order.orderStatus !== "Return Approved"
    ) {
      return;
    }

    for (const cartItem of order.cart.products) {
      const product = await Product.findById(cartItem.product);
      if (!product) {
        continue;
      }
      product.stock += cartItem.quantity;
      await product.save();
    }

    order.backStockStatus = "uploaded";
    await order.save();

    let userWallet = await Wallet.findOne({
      owner: order.user,
      userName: order.userName,
    });

    if (!userWallet) {
      userWallet = new Wallet({
        owner: order.user,
        userName: order.userName,
        balance: 0,
        transactions: [],
      });
    }

    if (
      order.cart.paymentOption === "withoutWallet" &&
      order.paymentMethod !== "COD"
    ) {
      const totalAmount = order.cart.totalAmount;
      userWallet.balance += totalAmount;

      userWallet.transactions.push({
        order: orderId,
        walletUpdate: "walletCredited",
      });
    } else if (
      order.paymentMethod === "COD" &&
      order.orderStatus === "Return Approved" &&
      order.cart.paymentOption === "withoutWallet"
    ) {
      const userWallet = await Wallet.findOne({ owner: order.user });

      const totalAmount = order.cart.totalAmount;
      userWallet.balance += totalAmount;
      // Add the current order ID to the wallet's transactions
      userWallet.transactions.push({
        order: orderId,
        walletUpdate: "walletCredited",
      });

      // Save the wallet
      await userWallet.save();
      return;
    } else if (order.cart.paymentOption === "withWallet") {
      const populatedUserWallet = await Wallet.populate(userWallet, {
        path: "transactions.order",
      });

      const transactionIndex = populatedUserWallet.transactions.findIndex(
        (transaction) => {
          return (
            transaction.order &&
            transaction.order._id.toString() === orderId.toString() &&
            transaction.walletUpdate === "walletNotCredited"
          );
        }
      );

      if (transactionIndex !== -1) {
        const transaction = populatedUserWallet.transactions[transactionIndex];

        if (
          order.paymentMethod !== "COD" &&
          (order.orderStatus === "Cancel" ||
            order.orderStatus === "Return Approved")
        ) {
          const totalAmount = order.cart.totalAmount;
          userWallet.balance += totalAmount;
        } else if (
          order.paymentMethod === "COD" &&
          order.cart.paymentOption === "withWallet" &&
          order.orderStatus !== "Return Approved"
        ) {
          const walletAmount = order.cart.walletAmount;
          userWallet.balance += walletAmount;
        } else if (
          order.paymentMethod === "COD" &&
          order.cart.paymentOption === "withWallet" &&
          order.orderStatus === "Return Approved"
        ) {
          const totalAmount = order.cart.totalAmount;
          userWallet.balance += totalAmount;
        }

        transaction.walletUpdate = "walletCredited";
        populatedUserWallet.transactions[transactionIndex] = transaction;
      } else {
        populatedUserWallet.transactions.push({
          order: orderId,
          walletUpdate: "walletNotCredited",
        });
      }

      await populatedUserWallet.save();
    }

    await userWallet.save();
  } catch (error) {}
};

const renderSingleOrderPage = async (req, res, next) => {
  try {
    // Fetch the specific order from the database using the provided ID and populate the 'cart.products.product' field
    const order = await Order.findById(req.params.id).populate(
      "cart.products.product"
    );

    if (!order) {
      // If the order is not found, redirect to an error page or handle accordingly
      return res.redirect("/error");
    }

    res.render("admin/view_order", {
      title: "Admin View Order Details",
      order: order,

      admin: req.session.admin,
      message: req.session.message,
    }); // Pass the order data to the single order view
  } catch (error) {
    res.redirect("/error"); // Redirect to an error page
  }
};
const renderUserSingleOrderPage = async (req, res, next) => {
  try {
    // Fetch the specific order from the database using the provided ID and populate the 'cart.products.product' field
    const order = await Order.findById(req.params.id).populate(
      "cart.products.product"
    );

    if (!order) {
      // If the order is not found, redirect to an error page or handle accordingly
      return res.redirect("/error");
    }
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId });
    res.render("user/user_view_order", {
      title: "Order Details",
      order: order,
      cart: cart,
      user: req.session.user,
      message: req.session.message,
    }); // Pass the order data to the single order view
  } catch (error) {
    res.redirect("/error"); // Redirect to an error page
  }
};
const adminEditOrder = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const { orderStatus, adminConfirmation } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (orderStatus === "Return") {
      if (!adminConfirmation) {
        throw new Error("Admin confirmation required for return");
      }

      if (adminConfirmation === "yes") {
        order.orderStatus = "Return Approved";
      } else if (adminConfirmation === "no") {
        order.orderStatus = "Return Cancelled";
      }
    } else {
      order.orderStatus = orderStatus;
    }

    //Set the shipped timestamp if it is provided and the order status allows it
    if (
      !order.shippedTimestamp &&
      (orderStatus === "Shipped" || orderStatus === "Delivered")
    ) {
      order.shippedTimestamp = new Date(); // Store the current timestamp when the shipped date is set
    }

    // Set the delivered timestamp if it is provided and the order status is 'Delivered'
    if (!order.deliveredTimestamp && orderStatus === "Delivered") {
      // Make sure the delivered date is equal to or after the shipped date
      if (order.shippedTimestamp) {
        order.deliveredTimestamp = new Date(); // Store the current timestamp when the delivered date is set
      } else {
        throw new Error("Delivered date cannot be before the shipped date");
      }
    }

    await order.save();

    // Prepare the response data
    const responseData = {
      orderStatus: order.orderStatus,
      shippedDateTime: order.shippedTimestamp || null,
      deliveredDateTime: order.deliveredTimestamp || null,
    };

    res.json(responseData);
  } catch (error) {
    res.json({ success: false });
  }
};

const adminDeleteOrder = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    // Find the order by its ID and populate the 'cart.products.product' field
    const order = await Order.findById(orderId).populate(
      "cart.products.product"
    );

    if (!order) {
      return;
    }

    // Iterate over the products in the order and increment the stock
    for (const cartItem of order.cart.products) {
      const product = await Product.findById(cartItem.product);

      if (!product) {
        continue;
      }

      product.stock += cartItem.quantity;
      await product.save();
    }

    await Order.findByIdAndRemove(orderId);
    res.redirect("/admin/orders"); // Redirect to the orders page or you can render a success message
  } catch (error) {
    res.redirect("/error"); // Redirect to an error page or you can render an error message
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

const buyNow = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const productId = req.params.productId;

    const user = await User.findOne({ _id: userId });
    const product = await Product.findOne({ _id: productId }).populate(
      "category"
    );

    if (!product) {
      throw new Error("Product not found");
    }

    // Check if the product is in stock
    if (product.stock <= 0) {
      throw new Error("Product out of stock");
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      // If no cart exists, create a new cart
      cart = new Cart({
        user: userId,
        products: [],
        totalAmount: 0,
      });
    } else if (cart.products.length > 0) {
      // If the cart already contains products, redirect to the cart page
      return res.redirect("/cart");
    }

    // Calculate the final price
    const finalPrice = calculateFinalPrice(product);

    // Add the selected product to the cart
    cart.products.push({
      product: productId,
      quantity: 1,
      finalprice: finalPrice,
    });

    // Update the cart's total amount
    cart.totalAmount = finalPrice > 0 ? finalPrice : product.price;

    // Decrement the product's stock count
    product.stock -= 1;

    // Save the updated cart and product
    await Promise.all([cart.save(), product.save()]);

    // Redirect to the checkout page
    return res.redirect(`/user/checkOut/${userId}`);
  } catch (error) {
    // Rest of the error handling code...
  }
};

const userEditOrder = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const { orderStatus, returnReason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (orderStatus === "Cancel") {
      order.orderStatus = orderStatus;
      await order.save();

      res.json({ success: true });
    } else if (orderStatus === "Return" && returnReason) {
      order.orderStatus = orderStatus;
      order.reason = returnReason;
      await order.save();
      res.json({ success: true });
    } else {
      throw new Error("Invalid order status or missing return reason");
    }
  } catch (error) {
    res.json({ success: false });
  }
};

module.exports = {
  renderPlaceOrderPage,
  renderCheckOutPage,
  renderAdminOrderTable,
  adminEditOrder,
  adminDeleteOrder,
  buyNow,
  userEditOrder,
  renderSingleOrderPage,
  renderUserSingleOrderPage,
};
