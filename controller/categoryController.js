const express = require("express");
const Category = require("../models/category");
const adminRouter = express.Router();
const userRouter = express.Router();

// Define the validateCreateCategoryForm function
function validateCreateCategoryForm(formData) {
  const errors = {};

  // Validate name field
  if (!formData.name) {
    errors.name = "Name is required";
  } else if (!/^[A-Za-z\s]+$/.test(formData.name)) {
    errors.name = "Category name should only contain letters and spaces";
  }

  // Validate description field
  if (!formData.description) {
    errors.description = "Description is required";
  }

  return errors;
}

const addCategory = async (req, res) => {
  try {
    const { name, offerpercentage, description, status } = req.body;

    // Check if required fields are missing
    if (!name || !description) {
      req.session.message = {
        type: "danger",
        message: "Please provide all required fields",
      };
      return res.redirect("/admin/add_category");
    }

    const errors = validateCreateCategoryForm(req.body);

    // Handle validation errors and redirect if necessary
    if (Object.keys(errors).length > 0) {
      req.session.message = {
        type: "danger",
        message: "Please correct the errors in the form",
        errors: errors,
      };
      return res.redirect("/category/add");
    }

    // Check if category with the same name already exists (case-insensitive)
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingCategory) {
      req.session.message = {
        type: "danger",
        message: "Category with the same name already exists",
      };
      return res.redirect("/admin/category");
    }

    const category = new Category({
      name,
      offerpercentage,
      description,
      status,
    });

    await category.save();

    req.session.message = {
      type: "success",
      message: "Category added successfully!",
    };
    res.redirect("/admin/category");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/category");
  }
};

const renderAddCategoryPage = (req, res) => {
  if (req.session.admin) {
    res.render("admin/add_category", {
      title: "Add Users",
      message: req.session.message,
    });
  } else {
    res.render("admin/admin_login", { title: "Admin Login" });
  }
};
// Edit category
const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const category = await Category.findById(id);

    if (!category) {
      req.session.message = {
        type: "danger",
        message: "Category not found!",
      };
      return res.redirect("/admin/category");
    }

    res.render("admin/edit_category", {
      title: "Edit Category",
      category: category,
      message: req.session.message,
    });
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/category");
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const category = await Category.findById(id);

    if (!category) {
      req.session.message = {
        type: "danger",
        message: "Category not found!",
      };
      return res.redirect("/admin/category");
    }

    category.name = req.body.name;
    category.offerpercentage = req.body.offerpercentage;
    category.description = req.body.description;
    category.status = req.body.status;

    await category.save();

    req.session.message = {
      type: "success",
      message: "Category updated successfully!",
    };
    res.redirect("/admin/category");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/category");
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const category = await Category.findById(id);

    if (!category) {
      req.session.message = {
        type: "danger",
        message: "Category not found!",
      };
      return res.redirect("/admin/category");
    }

    await category.deleteOne();

    req.session.message = {
      type: "success",
      message: "Category deleted successfully!",
    };
    res.redirect("/admin/category");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/category");
  }
};

module.exports = {
  addCategory,
  editCategory,
  updateCategory,
  deleteCategory,
  renderAddCategoryPage,
};
