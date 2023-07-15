const express = require("express");
const User = require("../models/users");
const Cart = require("../models/cart");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const session = require("express-session");
const bodyParser = require("body-parser");
const userRouter = express.Router();
const mongoose = require("mongoose");

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

const editUser = (req, res) => {
  let id = req.params.id;
  User.findById(id)
    .exec()
    .then((user) => {
      if (user == null) {
        req.session.message = {
          type: "danger",
          message: "User not found!",
        };
        res.redirect("/admin/users");
      } else {
        res.render("admin/edit_users", {
          title: "Edit User",
          user: user,
          message: req.session.message,
        });
      }
    })
    .catch((err) => {
      req.session.message = {
        type: "danger",
        message: err.message,
      };
      res.redirect("/admin/users");
    });
};

const addressAdd = async (req, res) => {
  try {
    const userId = req.params.Id;
    const user = await User.findById(userId);

    const cart = await Cart.findOne({ user: userId });
    if (!user) {
      return res.status(404).send("User not found");
    }

    const address = user.addresses.length > 0 ? user.addresses[0] : null;
    res.render("user/addressPage", {
      user: user,
      userId: userId,
      address: address,

      cart: cart,
    });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

const updateAddress = async (req, res) => {
  try {
    const {
      userId,
      selectedAddress,
      houseName,
      street,
      village,
      district,
      state,
      pincode,
    } = req.body;

    // Check if required fields are missing
    if (
      !userId ||
      (selectedAddress === undefined &&
        (!houseName || !street || !village || !district || !state || !pincode))
    ) {
      return res.status(400).send("Please provide all required fields");
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Update existing address
    if (selectedAddress !== undefined && selectedAddress !== "none") {
      const selectedAddressIndex = parseInt(selectedAddress);

      if (selectedAddressIndex >= user.addresses.length) {
        return res.status(400).send("Invalid selected address");
      }

      // Modify the address fields as required
      const updatedAddress = {
        ...user.addresses[selectedAddressIndex],
        houseName,
        street,
        village,
        district,
        state,
        pincode,
      };

      user.addresses[selectedAddressIndex] = updatedAddress;
    }
    // Add new address
    else if (user.addresses.length < 3) {
      const newAddress = {
        houseName,
        street,
        village,
        district,
        state,
        pincode,
      };

      user.addresses.push(newAddress);
    }
    // Maximum limit of 3 addresses reached
    else {
      return res.status(400).send("Maximum limit of addresses reached");
    }

    await user.save();
    res.redirect("user/addressPage" + userId);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

const addUserAddress = async (req, res) => {
  try {
    const {
      userId,
      addressIndex,
      houseName,
      street,
      village,
      district,
      state,
      pincode,
      selectedAddress,
    } = req.body;

    // Check if required fields are missing
    if (
      !userId ||
      !addressIndex ||
      !houseName ||
      !street ||
      !village ||
      !district ||
      !state ||
      !pincode
    ) {
      return res.status(400).send("Please provide all required address fields");
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Check if addressIndex is valid
    const index = parseInt(addressIndex);
    if (isNaN(index) || index < 0 || index > user.addresses.length) {
      return res.status(400).send("Invalid address index");
    }

    const address = {
      houseName,
      street,
      village,
      district,
      state,
      pincode,
    };

    // Insert the new address at the specified index
    user.addresses.splice(index, 0, address);

    // If the number of addresses exceeds the maximum limit, remove the last address
    if (user.addresses.length > 2) {
      user.addresses.pop();
    }

    // Remove the selected address if provided
    if (selectedAddress === "address1") {
      user.addresses.splice(0, 1);
    }
    if (selectedAddress === "address2") {
      user.addresses.splice(1, 1);
    }
    user.selectedAddress = selectedAddress; // Update the selected address
    await user.save();

    req.session.message = {
      type: "success",
      message: "Address added successfully!",
    };

    const cart = await Cart.findOne({ user: userId });
    res.render("user/addressPage", {
      user: user,
      userId: userId,
      address: address,

      cart: cart,
    });
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    const cart = await Cart.findOne({ user: userId });
    res.render("user/addressPage", {
      user: user,
      userId: userId,
      address: address,

      cart: cart,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    let id = req.params.id;
    const user = await User.findById(id);

    if (!user) {
      // User with the specified id does not exist
      req.session.message = {
        type: "danger",
        message: "User not found!",
      };
      return res.redirect("/admin/users");
    }

    if (user.image) {
      // Delete the user's thumbnail file
      const thumbnailPath = path.join("uploads", "user", user.image);
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }

    await user.deleteOne(); // Use deleteOne() instead of remove()

    req.session.message = {
      type: "info",
      message: "User deleted successfully!",
    };
    res.redirect("/admin/users");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/users");
  }
};

// Serve the user's image
userRouter.get("/userimage/:image", (req, res) => {
  const image = req.params.image;
  const imagePath = path.join(__dirname, "..", "uploads", "user", image);
  res.sendFile(imagePath);
});

// Block user
const blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      req.session.message = {
        type: "danger",
        message: "User not found",
      };
      res.redirect("/admin/users");
    }

    user.access = "blocked"; // Set the access status to 'blocked'
    await user.save();

    req.session.message = {
      type: "success",
      message: "User blocked successfully",
    };
    res.redirect("/admin/users");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/users");
  }
};

// Unblock user
const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      req.session.message = {
        type: "danger",
        message: "User not found",
      };
      res.redirect("/admin/users");
    }

    user.access = "unblocked"; // Set the access status to 'unblocked'
    await user.save();

    req.session.message = {
      type: "success",
      message: "User unblocked successfully",
    };
    res.redirect("/admin/users");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/users");
  }
};

module.exports = {
  editUser,
  deleteUser,
  userRouter,
  blockUser,
  unblockUser,
  addressAdd,
  updateAddress,
  addUserAddress,
};
