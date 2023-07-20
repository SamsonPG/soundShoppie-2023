const Carousel = require("../models/carousel");
const multer = require("multer");
const fs = require("fs");
const sharp = require("sharp");
const path = require("path");
// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Define the destination directory for uploaded files
    const uploadDir = "uploads/carousel";
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
// Render Add Carousel Form
const renderAddCarouselForm = (req, res) => {
  res.render("admin/add_carousel", {
    message: req.session.message,
    title: "Add Carousel",
  });
};

// Render Edit Carousel Form
const renderEditCarouselForm = async (req, res) => {
  try {
    const id = req.params.id;
    const carousel = await Carousel.findById(id);

    if (!carousel) {
      return res.status(404).json({ error: "Carousel not found" });
    }

    res.render("admin/edit_carousel", {
      carousel,
      message: req.session.message,
      title: "Edit Carousel",
    });
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/carousel_table");
  }
};

// Render Carousel Table
const renderCarouselTable = async (req, res) => {
  try {
    const carousels = await Carousel.find();
    res.render("admin/carousel_table", {
      carousels,
      message: req.session.message,
      title: "Admin Carousel Panel",
    });
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/carousel_table ");
  }
};

// Add Carousel
const addCarousel = async (req, res) => {
  try {
    const { heading, subHeading, carouselstatus } = req.body;

    const carousel = new Carousel({
      heading,
      subHeading,

      carouselstatus,
    });
    // Check if there are any uploaded files
    if (req.files && req.files.length > 0) {
      const images = [];

      for (const file of req.files) {
        // Generate thumbnail from the uploaded image
        const thumbnailBuffer = await sharp(file.path)
          .resize(1440, 600, { fit: "cover" })
          .jpeg(sharpOptions) // Specify the options for JPEG format
          .png(sharpOptions.png) // Specify the options for PNG format
          .toBuffer();

        // Save the thumbnail with a different filename
        const thumbnailFilename = `${Date.now()}-thumbnail${path.extname(
          file.originalname
        )}`;
        const thumbnailPath = path.join(
          "uploads",
          "carousel",
          thumbnailFilename
        );
        await sharp(thumbnailBuffer).toFile(thumbnailPath);

        // Push the thumbnail filename to the images array
        images.push(thumbnailFilename);

        // Delete the temporary uploaded file
        fs.unlinkSync(file.path);
      }

      // Assign the images array to the product object
      carousel.images = images;
    }
    await carousel.save();

    return res.redirect("/admin/carousel_table");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/carousel_table");
  }
};

// Get all Carousels
const getAllCarousels = async (req, res) => {
  try {
    const carousels = await Carousel.find();

    res.json(carousels);
  } catch (error) {
    res.status(500).json({ error: "An error occurred" });
  }
};

// Get a single Carousel
const getCarouselById = async (req, res) => {
  try {
    const id = req.params.id;
    const carousel = await Carousel.findById(id);

    if (!carousel) {
      return res.status(404).json({ error: "Carousel not found" });
    }

    res.json(carousel);
  } catch (error) {
    res.status(500).json({ error: "An error occurred" });
  }
};

const updateCarousel = async (req, res) => {
  try {
    const id = req.params.id;
    // const { heading, subHeading, carouselstatus } = req.body;

    const carousel = await Carousel.findById(id);

    if (!carousel) {
      return res.status(404).json({ error: "Carousel not found" });
    }

    if (req.body.heading) {
      carousel.heading = req.body.heading;
    }

    if (req.body.subHeading) {
      carousel.subHeading = req.body.subHeading;
    }

    carousel.carouselstatus = req.body.carouselstatus;

    // Check if there are any uploaded files
    if (req.files && req.files.images) {
      const images = [];

      // Iterate over the file fields and process each one
      for (const key of Object.keys(req.files.images)) {
        const file = req.files.images[key];

        // Generate thumbnail from the uploaded image
        const thumbnailBuffer = await sharp(file.path)
          .resize(600, 800, { fit: "cover" })
          .jpeg(sharpOptions) // Specify the options for JPEG format
          .png(sharpOptions.png) // Specify the options for PNG format
          .toBuffer();

        // Save the thumbnail with a different filename
        const thumbnailFilename = `${Date.now()}-thumbnail-${file.name}`;
        const thumbnailPath = path.join(
          "uploads",
          "carousel",
          thumbnailFilename
        );
        await sharp(thumbnailBuffer).toFile(thumbnailPath);

        // Push the thumbnail filename to the images array
        images.push(thumbnailFilename);

        // Delete the temporary uploaded file
        fs.unlinkSync(file.path);
      }

      // Assign the images array to the carousel object
      carousel.images = images;
    }
    await carousel.save();

    return res.redirect("/admin/carousel_table");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/carousel_table");
  }
};

// Delete Carousel

const deleteCarousel = async (req, res) => {
  try {
    const id = req.params.id;
    const carousel = await Carousel.findById(id);

    if (!carousel) {
      req.session.message = {
        type: "danger",
        message: "Category not found!",
      };
      return res.redirect("/admin/carousel_table");
    }
    // Delete the product's thumbnail files
    for (const image of carousel.images) {
      const thumbnailPath = path.join("uploads", "carousel", image);
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }
    await carousel.deleteOne();

    req.session.message = {
      type: "success",
      message: "Category deleted successfully!",
    };
    res.redirect("/admin/carousel_table");
  } catch (error) {
    req.session.message = {
      type: "danger",
      message: error.message,
    };
    res.redirect("/admin/carousel_table");
  }
};
module.exports = {
  renderAddCarouselForm,
  renderEditCarouselForm,
  renderCarouselTable,
  addCarousel,
  getAllCarousels,
  getCarouselById,
  updateCarousel,
  deleteCarousel,
};
