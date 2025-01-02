const expressAsyncHandler = require("express-async-handler");
const Message = require("../modals/messageModel");
const User = require("../modals/userModel");
const Chat = require("../modals/chatModel");
const cloudinary = require("cloudinary").v2;

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const emitSocketEvent = (io, roomId, eventName, data) => {
  io.to(roomId).emit(eventName, data);
};

const allMessages = expressAsyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name email")
      .populate("receiver", "name email")
      .populate("chat");
    res.json(messages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const sendMessage = expressAsyncHandler(async (req, res) => {
  const { content, chatId, receiverId } = req.body;

  if (!content || !chatId || !receiverId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  const newMessage = {
    sender: req.user._id,
    receiver: receiverId,
    content: content,
    chat: chatId,
  };

  try {
    let message = await Message.create(newMessage);

    message = await message.populate("sender", "name pic");
    message = await message.populate("receiver", "name pic");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    const io = req.app.get('io');
    emitSocketEvent(io, chatId, "message received", message);
    
    // Notify specific receiver
    const receiverSocketId = io.sockets.adapter.users?.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("new message notification", {
        chatId,
        message: message,
      });
    }

    // Stopped typing 
    emitSocketEvent(io, chatId, "stop typing", req.user._id);

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const uploadFileMessage = expressAsyncHandler(async (req, res) => {
  const { chatId, receiverId } = req.body;

  if (!req.file || !chatId || !receiverId) {
    console.log("Invalid data passed into request");
    return res.status(400).json({ message: "Invalid file or chatId" });
  }

  try {
    const uploadedFile = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto",
      folder: "chat_uploads",
    });

    const fileBuffer = req.file.buffer;

    const newMessage = {
      sender: req.user._id,
      receiver: receiverId,
      content: uploadedFile.secure_url,
      isFile: true,
      fileType: req.file.mimetype,
      fileName: req.file.originalname,
      fileContent: fileBuffer.toString("base64"),
    };

    let message = await Message.create(newMessage);

    message = await message.populate("sender", "name pic");
    message = await message.populate("receiver", "name pic");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    const io = req.app.get('io');
    emitSocketEvent(io, chatId, "file message received", message);
    
    // Notify specific receiver about file
    const receiverSocketId = io.sockets.adapter.users?.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("new file notification", {
        chatId,
        message: message,
      });
    }

    res.json(message);
  } catch (error) {
    console.error("Error uploading file message:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
});

const getRecipientName = async (req, res) => {
  const { chat_id } = req.params;
  const userId = req.user._id;
  try {
    const chat = await Chat.findById(chat_id).populate("users", "name");

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const recipient = chat.users.find(
      (user) => user._id.toString() !== userId.toString()
    );

    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    res.status(200).json({ recipientName: recipient.name });
  } catch (error) {
    console.error("Error fetching recipient name:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};


const handleTyping = expressAsyncHandler(async (req, res) => {
  const { chatId, isTyping } = req.body;
  
  const io = req.app.get('io');
  const eventName = isTyping ? "typing" : "stop typing";
  
  emitSocketEvent(io, chatId, eventName, {
    userId: req.user._id,
    chatId
  });
  
  res.sendStatus(200);
});


const markMessageAsRead = expressAsyncHandler(async (req, res) => {
  const { messageId } = req.params;
  
  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (!message.readBy.includes(req.user._id)) {
      message.readBy.push(req.user._id);
      await message.save();

      const io = req.app.get('io');
      emitSocketEvent(io, message.chat.toString(), "message read", {
        messageId,
        readBy: req.user._id
      });
    }

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

module.exports = { 
  allMessages, 
  sendMessage, 
  uploadFileMessage, 
  getRecipientName,
  handleTyping,
  markMessageAsRead
};