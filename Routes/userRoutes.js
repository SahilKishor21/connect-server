const express = require("express");
const {
  loginController,
  registerController,
  fetchAllUsersController,
} = require("../Controllers/userController");

const { protect } = require("../middleware/authMiddleware");

// Add these imports for the new routes
const User = require("../models/userModel");
const mongoose = require('mongoose');

const Router = express.Router();

Router.post("/login", loginController);
Router.post("/register", registerController);
Router.get("/fetchUsers", protect, fetchAllUsersController);

// UPDATED: Enhanced search user by name (for call functionality)
Router.get("/search", protect, async (req, res) => {
  try {
    const { name, email } = req.query;
    
    if (!name && !email) {
      return res.status(400).json({ message: "Name or email parameter is required" });
    }

    console.log("🔍 Searching for user with name:", name, "email:", email);

    let query = {};
    
    if (name) {
      // Search by exact name first, then partial match
      query = {
        $or: [
          { name: name }, // Exact match first
          { name: { $regex: name, $options: "i" } }, // Case insensitive partial match
        ]
      };
    }
    
    if (email) {
      query.email = { $regex: email, $options: "i" };
    }

    // Find the best match (exact name match preferred)
    let user = await User.findOne({ name: name }).select("-password");
    
    if (!user && name) {
      // If no exact match, try partial match
      user = await User.findOne(query).select("-password");
    }

    if (!user) {
      console.log("❌ User not found with name:", name);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ Found user:", user._id, user.name);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic || user.profilePicture
    });

  } catch (error) {
    console.error("❌ Error searching for user:", error);
    res.status(500).json({ message: "Server error while searching for user" });
  }
});

// NEW: Get user by ID - Required for recipient validation
Router.get("/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log("🔍 Fetching user by ID:", userId);
    
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("❌ Invalid user ID format:", userId);
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    
    const user = await User.findById(userId).select("-password");
    
    if (!user) {
      console.log("❌ User not found with ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log("✅ Found user by ID:", user._id, user.name);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic || user.profilePicture,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error("❌ Error fetching user by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// NEW: Get all users - For debugging and fallback user resolution
Router.get("/all", protect, async (req, res) => {
  try {
    console.log("🔍 Fetching all users (limited to 100)");
    
    // Limit results to prevent large responses
    const users = await User.find()
      .select("-password")
      .limit(100)
      .sort({ name: 1 });
    
    console.log("✅ Found", users.length, "users");
    res.json(users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic || user.profilePicture,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    })));
  } catch (error) {
    console.error("❌ Error fetching all users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// NEW: Check if user exists by ID - For validation
Router.get("/exists/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log("🔍 Checking if user exists:", userId);
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({ exists: false, user: null });
    }
    
    const user = await User.findById(userId).select("_id name email isOnline lastSeen");
    
    console.log("✅ User existence check:", !!user);
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
    console.error("❌ Error checking user existence:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = Router;