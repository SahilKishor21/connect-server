// chatControllers.js
const asyncHandler = require("express-async-handler");
const Chat = require("../modals/chatModel");
const User = require("../modals/userModel");
const Message = require("../modals/messageModel");

const accessChat = asyncHandler(async (req, res) => {
  const { userId, isGroup, chatId } = req.body;

  
  if (isGroup && chatId) {
    try {
      const groupChat = await Chat.findById(chatId);
      if (!groupChat || !groupChat.isGroupChat) {
        return res.status(400).json({ message: "Group chat not found" });
      }

      // Checking if user is already in the group
      if (groupChat.users.includes(req.user._id)) {
        const populatedChat = await Chat.findOne({ _id: chatId })
          .populate("users", "-password")
          .populate("groupAdmin", "-password")
          .populate("latestMessage");

        return res.status(200).json(populatedChat);
      }

      // Add user to group
      const updatedChat = await Chat.findByIdAndUpdate(
        chatId,
        {
          $push: { users: req.user._id },
        },
        { new: true }
      )
        .populate("users", "-password")
        .populate("groupAdmin", "-password")
        .populate("latestMessage");

      return res.status(200).json(updatedChat);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }

  //  one-on-one chating
  if (!userId) {
    return res.status(400).json({ message: "UserId param not sent with request" });
  }

  var isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select: "name email",
  });

  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    var chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password"
      );
      res.status(200).json(FullChat);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});

const fetchChats = asyncHandler(async (req, res) => {
  try {
    Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 })
      .then(async (results) => {
        results = await User.populate(results, {
          path: "latestMessage.sender",
          select: "name email",
        });
        res.status(200).send(results);
      });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const fetchChatDetailsController = async (req, res) => {
  try {
    const { chatId } = req.params;
    
    console.log("🔍 Fetching chat details for chat ID:", chatId);

    const chat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("latestMessage");

    if (!chat) {
      console.log("❌ Chat not found with ID:", chatId);
      return res.status(404).json({ message: "Chat not found" });
    }

    // Check if user is part of this chat
    const isUserInChat = chat.users.some(user => 
      user._id.toString() === req.user._id.toString()
    );

    if (!isUserInChat) {
      console.log("❌ User not authorized to access chat:", chatId);
      return res.status(403).json({ message: "Not authorized to access this chat" });
    }

    console.log("✅ Found chat with users:", chat.users.map(u => `${u._id}:${u.name}`));
    res.json(chat);

  } catch (error) {
    console.error("❌ Error fetching chat details:", error);
    res.status(500).json({ message: "Server error while fetching chat" });
  }
};

const fetchGroups = asyncHandler(async (req, res) => {
  try {
    const allGroups = await Chat.where("isGroupChat").equals(true);
    res.status(200).send(allGroups);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const createGroupChat = asyncHandler(async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Data is insufficient" });
  }

  var users = JSON.parse(req.body.users);
  users.push(req.user);

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user,
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const groupExit = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  const removed = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!removed) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(removed);
  }
});

const groupExitWithNotification = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  if (!chatId || !userId) {
    return res.status(400).json({ message: "ChatId and UserId are required" });
  }

  try {
    // First, get the user details before removing
    const user = await User.findById(userId).select("name");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get the chat to verify it exists and user is a member
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Check if user is actually in the chat
    if (!chat.users.includes(userId)) {
      return res.status(400).json({ message: "User is not a member of this chat" });
    }

    // Remove user from group
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      {
        $pull: { users: userId },
      },
      {
        new: true,
      }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!updatedChat) {
      return res.status(404).json({ message: "Failed to update chat" });
    }

    // Create notification message using the leaving user as sender
    const notificationContent = `${user.name} has left the group`;
    const notificationMessage = {
      sender: userId, // Use the leaving user as sender
      receiver: userId, // Use the leaving user as receiver 
      content: notificationContent,
      chat: chatId,
      isNotification: true,
      notificationType: 'group_leave',
    };

    // Save notification message
    let message = await Message.create(notificationMessage);
    message = await message.populate("sender", "name");
    message = await message.populate("receiver", "name");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name email",
    });

    // Update latest message
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      // Notify remaining group members about user leaving
      io.to(chatId).emit("user left group", {
        chatId: chatId,
        userId: userId,
        userName: user.name,
        updatedChat: updatedChat
      });

      // Send notification message to remaining members
      io.to(chatId).emit("notification received", {
        message: message,
        chatId: chatId,
        type: 'group_leave'
      });
    }

    console.log(`✅ User ${user.name} (${userId}) left group ${chatId}`);

    res.json({
      success: true,
      message: "User left group successfully",
      chat: updatedChat,
      notification: message
    });

  } catch (error) {
    console.error("❌ Error in group exit:", error);
    res.status(500).json({ 
      message: "Server error while leaving group",
      error: error.message 
    });
  }
});


module.exports = {
  accessChat,
  fetchChats,
  fetchGroups,
  createGroupChat,
  groupExit,
  fetchChatDetailsController,
  groupExitWithNotification
};