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

      if (groupChat.users.includes(req.user._id)) {
        const populatedChat = await Chat.findOne({ _id: chatId })
          .populate("users", "-password")
          .populate("groupAdmin", "-password")
          .populate("latestMessage");

        return res.status(200).json(populatedChat);
      }

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
      .populate("groupAdmin", "-password")
      .populate("latestMessage");

    if (!chat) {
      console.log("❌ Chat not found with ID:", chatId);
      return res.status(404).json({ message: "Chat not found" });
    }

    const isUserInChat = chat.users.some(user => 
      user._id.toString() === req.user._id.toString()
    );

    if (!isUserInChat) {
      console.log("❌ User not authorized to access chat:", chatId);
      return res.status(403).json({ message: "Not authorized to access this chat" });
    }

    console.log("✅ Found chat with users:", chat.users.map(u => `${u._id}:${u.name}`));
    console.log("✅ Group admin:", chat.groupAdmin);
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
  users.push(req.user._id);

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user._id,
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
    return res.status(400).json({ 
      success: false,
      message: "ChatId and UserId are required" 
    });
  }

  try {
    console.log('🔄 Processing group exit for user:', userId, 'from chat:', chatId);

    const user = await User.findById(userId).select("name");
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        success: false,
        message: "Chat not found" 
      });
    }

    if (!chat.users.includes(userId)) {
      return res.status(400).json({ 
        success: false,
        message: "User is not a member of this chat" 
      });
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { users: userId } },
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!updatedChat) {
      return res.status(404).json({ 
        success: false,
        message: "Failed to update chat" 
      });
    }

    const notificationContent = `${user.name} has left the group`;
    const notificationMessage = {
      sender: null,
      receiver: null,
      content: notificationContent,
      chat: chatId,
      isNotification: true,
      notificationType: 'group_leave',
    };

    let message = await Message.create(notificationMessage);
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    const io = req.app.get('io');
    if (io) {
      console.log('📡 Emitting socket events for group exit');
      
      io.to(chatId).emit("user left group", {
        chatId: chatId,
        userId: userId,
        userName: user.name,
        updatedChat: updatedChat
      });

      io.to(chatId).emit("notification received", {
        message: message,
        chatId: chatId,
        type: 'group_leave'
      });
    } else {
      console.log('⚠️ Socket.io not available');
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
      success: false,
      message: "Server error while leaving group",
      error: error.message 
    });
  }
});

const removeUserFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId, userIdToRemove } = req.body;

  if (!chatId || !userId || !userIdToRemove) {
    return res.status(400).json({ 
      success: false,
      message: "ChatId, userId, and userIdToRemove are required" 
    });
  }

  try {
    console.log('🔄 Processing user removal:', { chatId, userId, userIdToRemove });

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        success: false,
        message: "Chat not found" 
      });
    }

    if (chat.groupAdmin.toString() !== userId) {
      return res.status(403).json({ 
        success: false,
        message: "Only group admin can remove users" 
      });
    }

    if (userId === userIdToRemove) {
      return res.status(400).json({ 
        success: false,
        message: "Admin cannot remove themselves. Transfer admin rights first." 
      });
    }

    const userToRemove = await User.findById(userIdToRemove).select("name");
    const adminUser = await User.findById(userId).select("name");

    if (!userToRemove || !adminUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { users: userIdToRemove } },
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!updatedChat) {
      return res.status(500).json({ 
        success: false,
        message: "Failed to update chat" 
      });
    }

    const notificationContent = `${userToRemove.name} was removed from the group by ${adminUser.name}`;
    const notificationMessage = {
      sender: null,
      receiver: null,
      content: notificationContent,
      chat: chatId,
      isNotification: true,
      notificationType: 'user_removed',
    };

    let message = await Message.create(notificationMessage);
    message = await message.populate("chat");
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    const io = req.app.get('io');
    if (io) {
      console.log('📡 Emitting socket events for user removal');
      
      io.to(chatId).emit("user removed from group", {
        chatId,
        removedUserId: userIdToRemove,
        removedUserName: userToRemove.name,
        adminName: adminUser.name,
        updatedChat
      });

      io.to(chatId).emit("notification received", {
        message,
        chatId,
        type: 'user_removed'
      });
    }

    console.log(`✅ User ${userToRemove.name} removed by ${adminUser.name} from group ${chatId}`);

    res.json({
      success: true,
      message: "User removed successfully",
      chat: updatedChat
    });

  } catch (error) {
    console.error("❌ Error removing user from group:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
});

const addUserToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId, userIdToAdd } = req.body;

  if (!chatId || !userId || !userIdToAdd) {
    return res.status(400).json({ 
      success: false,
      message: "ChatId, userId, and userIdToAdd are required" 
    });
  }

  try {
    console.log('🔄 Processing add user:', { chatId, userId, userIdToAdd });

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        success: false,
        message: "Chat not found" 
      });
    }

    if (chat.groupAdmin.toString() !== userId) {
      return res.status(403).json({ 
        success: false,
        message: "Only group admin can add users" 
      });
    }

    if (chat.users.includes(userIdToAdd)) {
      return res.status(400).json({ 
        success: false,
        message: "User is already in the group" 
      });
    }

    const userToAdd = await User.findById(userIdToAdd).select("name");
    const adminUser = await User.findById(userId).select("name");

    if (!userToAdd || !adminUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $push: { users: userIdToAdd } },
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    const notificationContent = `${userToAdd.name} was added to the group by ${adminUser.name}`;
    const notificationMessage = {
      sender: null,
      receiver: null,
      content: notificationContent,
      chat: chatId,
      isNotification: true,
      notificationType: 'user_added',
    };

    let message = await Message.create(notificationMessage);
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    const io = req.app.get('io');
    if (io) {
      console.log('📡 Emitting socket events for user addition');
      
      io.to(chatId).emit("user added to group", {
        chatId,
        addedUserId: userIdToAdd,
        addedUserName: userToAdd.name,
        updatedChat
      });

      io.to(chatId).emit("notification received", {
        message,
        chatId,
        type: 'user_added'
      });
    }

    console.log(`✅ User ${userToAdd.name} added by ${adminUser.name} to group ${chatId}`);

    res.json({ 
      success: true,
      message: "User added successfully",
      chat: updatedChat 
    });

  } catch (error) {
    console.error("❌ Error adding user to group:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
});

const changeGroupAdmin = asyncHandler(async (req, res) => {
  const { chatId, currentAdminId, newAdminId } = req.body;

  if (!chatId || !currentAdminId || !newAdminId) {
    return res.status(400).json({ 
      success: false,
      message: "ChatId, currentAdminId, and newAdminId are required" 
    });
  }

  try {
    console.log('🔄 Processing admin change:', { chatId, currentAdminId, newAdminId });

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        success: false,
        message: "Chat not found" 
      });
    }

    if (chat.groupAdmin.toString() !== currentAdminId) {
      return res.status(403).json({ 
        success: false,
        message: "Only current admin can transfer admin rights" 
      });
    }

    if (!chat.users.includes(newAdminId)) {
      return res.status(400).json({ 
        success: false,
        message: "New admin must be a group member" 
      });
    }

    const currentAdmin = await User.findById(currentAdminId).select("name");
    const newAdmin = await User.findById(newAdminId).select("name");

    if (!currentAdmin || !newAdmin) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { groupAdmin: newAdminId },
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    const notificationContent = `${newAdmin.name} is now the group admin`;
    const notificationMessage = {
      sender: null,
      receiver: null,
      content: notificationContent,
      chat: chatId,
      isNotification: true,
      notificationType: 'admin_changed',
    };

    let message = await Message.create(notificationMessage);
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    const io = req.app.get('io');
    if (io) {
      console.log('📡 Emitting socket events for admin change');
      
      io.to(chatId).emit("admin changed", {
        chatId,
        newAdminId,
        newAdminName: newAdmin.name,
        updatedChat
      });

      io.to(chatId).emit("notification received", {
        message,
        chatId,
        type: 'admin_changed'
      });
    }

    console.log(`✅ Admin changed from ${currentAdmin.name} to ${newAdmin.name} in group ${chatId}`);

    res.json({ 
      success: true,
      message: "Admin changed successfully",
      chat: updatedChat 
    });

  } catch (error) {
    console.error("❌ Error changing group admin:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
});

const debugGroupChat = asyncHandler(async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");
    
    console.log("🔍 Debug Chat:", {
      chatId: chat._id,
      chatName: chat.chatName,
      isGroupChat: chat.isGroupChat,
      groupAdmin: chat.groupAdmin,
      users: chat.users.map(u => ({ id: u._id, name: u.name }))
    });
    
    res.json({
      chatId: chat._id,
      chatName: chat.chatName,
      isGroupChat: chat.isGroupChat,
      groupAdmin: chat.groupAdmin,
      users: chat.users
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  accessChat,
  fetchChats,
  fetchGroups,
  createGroupChat,
  groupExit,
  fetchChatDetailsController,
  groupExitWithNotification,
  removeUserFromGroup,
  addUserToGroup,
  changeGroupAdmin,
  debugGroupChat
};
