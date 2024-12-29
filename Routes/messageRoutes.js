const express = require("express");
const {
  allMessages,
  sendMessage,
  uploadFileMessage,
  getRecipientName,
} = require("../Controllers/messageControllers");
const { protect } = require("../middleware/authMiddleware");
const { upload, handleUploadError, uploadMultiple } = require("../middleware/fileuploadMiddleware");

const router = express.Router();

// Route to get all messages for a chat
router.route("/:chatId").get(protect, allMessages);

// Route to send a text message
router.route("/").post(protect, sendMessage);

// Route to handle single file upload in chat
router.route("/upload").post(protect, upload.single("file"), handleUploadError, uploadFileMessage);

<<<<<<< HEAD
// Route to handle multiple file uploads
router.post("/upload-multiple", protect, upload.array("files", 5), handleUploadError, async (req, res) => {
  try {
    const urls = req.files.map(file => file.path);
    res.json({ urls });
  } catch (error) {
    res.status(500).json({ error: "Error uploading files" });
  }
});

=======
// Single file upload
router.post("/upload", protect, upload.single("file"), handleUploadError, uploadFileMessage);

// Multiple files upload
router.post("/upload-multiple", protect, upload.array("files", 5), handleUploadError, async (req, res) => {
  try {
    const fileUrls = req.files.map(file => file.path);
    res.json({ success: true, files: fileUrls });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
// Route to get the recipient name
router.get("/recipient/:chat_id", protect, getRecipientName);

module.exports = router;
