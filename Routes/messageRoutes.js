const express = require("express");
const {
  allMessages,
  sendMessage,
  uploadFileMessage,
  getRecipientName,
  handleTyping,
  markMessageAsRead,
} = require("../Controllers/messageControllers");
const { protect } = require("../middleware/authMiddleware");
const { upload, handleUploadError, uploadMultiple } = require("../middleware/fileuploadMiddleware");

const router = express.Router();

router.route("/:chatId").get(protect, allMessages);
router.route("/").post(protect, sendMessage);
router.route("/upload").post(protect, upload.single("file"), handleUploadError, uploadFileMessage);
router.post("/upload-multiple", protect, upload.array("files", 5), handleUploadError, async (req, res) => {
  try {
    const urls = req.files.map(file => file.path);
    res.json({ urls });
  } catch (error) {
    res.status(500).json({ error: "Error uploading files" });
  }
});
router.get("/recipient/:chat_id", protect, getRecipientName);

router.route("/message/typing").post(protect, handleTyping);
router.route("/read/:messageId").put(protect, markMessageAsRead);

module.exports = router;