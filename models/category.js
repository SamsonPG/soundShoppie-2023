const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (value) {
        // Check if the value contains only letters and spaces
        return /^[A-Za-z\s]+$/.test(value);
      },
      message: "Category name should only contain letters and spaces",
    },
  },
  offerpercentage: {
    type: Number,
    default: 0.0,
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "inactive",
  },
  description: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Category", categorySchema);
