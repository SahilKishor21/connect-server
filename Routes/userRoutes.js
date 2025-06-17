const express = require("express");
const {
  loginController,
  registerController,
  fetchAllUsersController,
} = require("../Controllers/userController");

const { protect } = require("../middleware/authMiddleware");
const User = require("../models/userModel");
const mongoose = require('mongoose');

const Router = express.Router();

Router.post("/login", loginController);
Router.post("/register", registerController);
Router.get("/fetchUsers", protect, fetchAllUsersController);

Router.get("/search", protect, async (req, res) => {
  try {
    const { name, email } = req.query;
    
    if (!name && !email) {
      return res.status(400).json({ message: "Name or email parameter is required" });
    }

    console.log("🔍 Searching for user with name:", name, "email:", email);

    let query = {};
    
    if (name) {
      query = {
        $or: [
          { name: name }, 
          { name: { $regex: name, $options: "i" } },
        ]
      };
    }
    
    if (email) {
      query.email = { $regex: email, $options: "i" };
    }
    let user = await User.findOne({ name: name }).select("-password");
    
    if (!user && name) {
      user = await User.findOne(query).select("-password");
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic || user.profilePicture
    });

    } catch (error) {
    res.status(500).json({ message: "Server error while searching for user" });
    }
  });

  Router.get("/:userId", protect, async (req, res) => {
    try {
    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    
    const user = await User.findById(userId).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic || user.profilePicture,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });
    } catch (error) {
    res.status(500).json({ message: "Server error" });
    }
  });

  Router.get("/all", protect, async (req, res) => {
    try {
    const users = await User.find()
      .select("-password")
      .limit(100)
      .sort({ name: 1 });
    
    res.json(users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic || user.profilePicture,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    })));
    } catch (error) {
    res.status(500).json({ message: "Server error" });
    }
  });

  Router.get("/exists/:userId", protect, async (req, res) => {
    try {
    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({ exists: false, user: null });
    }
    
    const user = await User.findById(userId).select("_id name email isOnline lastSeen");
    
    res.json({
      exists: !!user,
      user: user ? {
      _id: user._id,
      name: user.name,
      email: user.email,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
      } : null
    });
    } catch (error) {
    res.status(500).json({ message: "Server error" });
    }
  });

  module.exports = Router;
