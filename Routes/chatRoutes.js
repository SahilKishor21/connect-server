const express = require("express");
const Router = express.Router();
const {
    createGroupChat,
    groupExit,
    fetchGroups,
} = require("../Controllers/chatController");
const { protect } = require("../middleware/authMiddleware");

Router.route("/").post(protect, accessChat);
Router.route("/").get(protect, fetchChats);
Router.route("/createGroup").post(protect, createGroupChat);
Router.route("/fetchGroups").get(protect, fetchGroups);
Router.route("/groupExit").put(protect, groupExit);

module.exports = Router;