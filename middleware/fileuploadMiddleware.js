const multer = require("multer");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
require("dotenv").config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "chat-uploads",
    allowed_formats: ["jpg", "jpeg", "png", "pdf", "webm", "mp3", "wav"],
    resource_type: "auto",
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    image: ["image/jpeg", "image/png", "image/gif"],
    document: ["application/pdf"],
    audio: ["audio/webm", "audio/mp3", "audio/wav", "audio/mpeg"],
  };

  const allAllowedTypes = Object.values(allowedTypes).flat();

  if (allAllowedTypes.includes(file.mimetype)) {
    // Set resource type for Cloudinary
    if (file.mimetype.startsWith("audio/")) {
      req.resourceType = "video"; // Cloudinary uses 'video' type for audio
    } else if (file.mimetype.startsWith("image/")) {
      req.resourceType = "image";
    } else {
      req.resourceType = "raw";
    }
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB as max size
  },
});

// Error handling middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File size too large",
        message: "Please upload a smaller file",
      });
    }
    return res.status(400).json({
      error: err.code,
      message: err.message,
    });
  }
  
  if (err) {
    return res.status(400).json({
      error: "File upload error",
      message: err.message,
    });
  }
  next();
};

module.exports = {
  upload,
  handleUploadError,
  cloudinary
};