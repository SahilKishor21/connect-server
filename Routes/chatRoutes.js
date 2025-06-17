const express = require("express");
const {
  accessChat,
  fetchChats,
  createGroupChat,
  groupExit,
  fetchGroups,
  fetchChatDetailsController,
  groupExitWithNotification,
  removeUserFromGroup,
  addUserToGroup,
  changeGroupAdmin,
  debugGroupChat
} = require("../Controllers/chatControllers"); // Keep your existing path
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").post(protect, accessChat);
router.route("/").get(protect, fetchChats);
router.route("/group").post(protect, createGroupChat);
router.route("/fetch").get(protect, fetchGroups);
router.route("/:chatId").get(protect, fetchChatDetailsController);
router.route("/groupExit").post(protect, groupExitWithNotification);  
router.route("/removeUser").post(protect, removeUserFromGroup);
router.route("/addUser").post(protect, addUserToGroup);
router.route("/changeAdmin").post(protect, changeGroupAdmin);
router.route("/debug/:chatId").get(protect, debugGroupChat);

module.exports = router;