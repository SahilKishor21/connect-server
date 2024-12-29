const expressAsyncHandler = require("express-async-handler");
const Message = require("../modals/messageModel");
const User = require("../modals/userModel");
const Chat = require("../modals/chatModel");
const cloudinary = require("cloudinary").v2; // Ensure Cloudinary SDK is installed

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const allMessages = expressAsyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name email")
      .populate("receiver", "name email") // Populate receiver field
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
<<<<<<< HEAD
    receiver: receiverId, 
=======
    receiver: receiverId, // Add receiver ID
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
    content: content,
    chat: chatId,
  };

  try {
    let message = await Message.create(newMessage);

    message = await message.populate("sender", "name pic");
<<<<<<< HEAD
    message = await message.populate("receiver", "name pic"); 
=======
    message = await message.populate("receiver", "name pic"); // Populate receiver
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });
    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

<<<<<<< HEAD
// Uploading file messages to Cloudinary and saving it to database
=======
// Upload file message to Cloudinary and save to database
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
const uploadFileMessage = expressAsyncHandler(async (req, res) => {
  const { chatId, receiverId } = req.body;

  if (!req.file || !chatId || !receiverId) {
    console.log("Invalid data passed into request");
    return res.status(400).json({ message: "Invalid file or chatId" });
  }

  try {
<<<<<<< HEAD
    // Uploading file to Cloudinary
=======
    // Upload file to Cloudinary
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
    const uploadedFile = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto",
      folder: "chat_uploads",
    });

<<<<<<< HEAD
    
=======
    // Read the file content (for small files like images/PDFs)
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
    const fileBuffer = req.file.buffer; // Use multer's buffer to get file content

    // Prepare message data with content or file buffer
    const newMessage = {
      sender: req.user._id,
<<<<<<< HEAD
      receiver: receiverId, 
      content: uploadedFile.secure_url, 
      isFile: true,
      fileType: req.file.mimetype,
      fileName: req.file.originalname,
      fileContent: fileBuffer.toString("base64"), 
=======
      receiver: receiverId, // Add receiver ID
      content: uploadedFile.secure_url, // Still save the Cloudinary URL
      chat: chatId,
      isFile: true,
      fileType: req.file.mimetype,
      fileName: req.file.originalname,
      fileContent: fileBuffer.toString("base64"), // Base64-encoded file content
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
    };

    let message = await Message.create(newMessage);

    message = await message.populate("sender", "name pic");
<<<<<<< HEAD
    message = await message.populate("receiver", "name pic"); 
=======
    message = await message.populate("receiver", "name pic"); // Populate receiver
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name email",
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    console.error("Error uploading file message:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
});

<<<<<<< HEAD

const getRecipientName = async (req, res) => {
  const { chat_id } = req.params; 
  const userId = req.user._id; 
  try {
    // Fetching the chat by ID
=======
// Get Recipient Name
const getRecipientName = async (req, res) => {
  const { chat_id } = req.params; // Extract chat ID from request params
  const userId = req.user._id; // Extract logged-in user ID from middleware

  try {
    // Fetch the chat by ID
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
    const chat = await Chat.findById(chat_id).populate("users", "name");

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Filter to find the recipient (the other user in the chat)
    const recipient = chat.users.find((user) => user._id.toString() !== userId.toString());

    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    res.status(200).json({ recipientName: recipient.name });
  } catch (error) {
    console.error("Error fetching recipient name:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { allMessages, sendMessage, uploadFileMessage, getRecipientName };
