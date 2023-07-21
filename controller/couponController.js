const express = require("express");
const Coupons = require("../models/coupon");
const adminRouter = express.Router();
const userRouter = express.Router();

// Validate create coupon form
function validateCreateCouponForm(formData) {
  const errors = {};

  // Validate code field
  if (!formData.code) {
    errors.code = "Code is required";
  }

  // Validate startingDate field
  if (!formData.startingDate) {
    errors.startingDate = "Starting date is required";
  }

  // Validate expiryDate field
  if (!formData.expiryDate) {
    errors.expiryDate = "Expiry date is required";
  }

  return errors;
}

const renderCouponPage = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.render("admin/admin_login", { title: "Admin Login" });
    }

    const coupons = await Coupons.find(); // Fetch categories from the database

    res.render("admin/coupons_table", {
      title: "Admin Coupons Panel",
      coupons,
      message: req.session.message,
    });
  } catch (error) {
    res.json({ msg: error.message });
  }
};
// Create coupon
const createCoupon = async (req, res) => {
  try {
    const { code, startingDate, expiryDate, discount, status } = req.body;

    // Check if required fields are missing
    if (!code || !startingDate || !expiryDate) {
      req.session.message = {
        type: "danger",
        message: "Please provide all required fields",
      };
      return res.redirect("/admin/add_coupon");
    }

    const errors = validateCreateCouponForm(req.body);

    // Handle validation errors and redirect if necessary
    if (Object.keys(errors).length > 0) {
      req.session.message = {
        type: "danger",
        message: "Please correct the errors in the form",
        errors: errors,
      };
      return res.redirect("/admin/add_coupon");
    }
    // Check if the coupon code already exists in the database

    const existingCoupon = await Coupons.findOne({ code });
    if (existingCoupon) {
      req.session.message = {
        type: "danger",
        message: "Coupon code already exists. Please use a different code.",
      };
      return res.redirect("/admin/coupons");
    }
    const coupon = new Coupons({
      code,
      startingDate,
      expiryDate,
      discount,
      status,
      created: Date.now(),
    });

    await coupon.save();

    req.session.message = {
      type: "success",
      message: "Coupon created successfully!",
    };
    res.redirect("/admin/coupons");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/coupons");
  }
};

// Render add coupon page
const renderAddCouponPage = (req, res) => {
  if (req.session.admin) {
    res.render("admin/add_coupon", {
      title: "Add Coupon",
      message: req.session.message,
    });
  } else {
    res.render("admin/admin_login", { title: "Admin Login" });
  }
};

// Edit coupon
const editCoupon = async (req, res) => {
  try {
    const id = req.params.id;
    const coupon = await Coupons.findById(id);

    if (!coupon) {
      req.session.message = {
        type: "danger",
        message: "Coupon not found!",
      };
      return res.redirect("/admin/coupons");
    }

    res.render("admin/edit_coupon", {
      title: "Edit Coupon",
      coupon: coupon,
      message: req.session.message,
    });
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/coupons");
  }
};

// Update coupon
const updateCoupon = async (req, res) => {
  try {
    const id = req.params.id;
    const coupon = await Coupons.findById(id);

    if (!coupon) {
      req.session.message = {
        type: "danger",
        message: "Coupon not found!",
      };
      return res.redirect("/admin/coupons");
    }
    // Check if the updated coupon code already exists in the database
    const existingCoupon = await Coupons.findOne({ code: req.body.code });
    if (existingCoupon && existingCoupon._id.toString() !== id) {
      req.session.message = {
        type: "danger",
        message: "Coupon code already exists. Please use a different code.",
      };
      return res.redirect("/admin/coupons");
    }
    coupon.code = req.body.code;
    coupon.startingDate = req.body.startingDate;
    coupon.expiryDate = req.body.expiryDate;
    coupon.discount = req.body.discount;
    coupon.status = req.body.status;

    await coupon.save();

    req.session.message = {
      type: "success",
      message: "Coupon updated successfully!",
    };
    res.redirect("/admin/coupons");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/coupons");
  }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const id = req.params.id;
    const coupon = await Coupons.findById(id);

    if (!coupon) {
      req.session.message = {
        type: "danger",
        message: "Coupon not found!",
      };
      return res.redirect("/admin/coupons");
    }

    await coupon.deleteOne();

    req.session.message = {
      type: "success",
      message: "Coupon deleted successfully!",
    };
    res.redirect("/admin/coupons");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/coupons");
  }
};

module.exports = {
  createCoupon,
  renderAddCouponPage,
  editCoupon,
  updateCoupon,
  deleteCoupon,
  renderCouponPage,
};
