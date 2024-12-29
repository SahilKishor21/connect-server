const mongoose = require("mongoose");

const messageModel = mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Ensure receiver is always specified
    },
    content: {
      type: String,
      trim: true, // Text content, used for regular text messages
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
    },
    type: {
      type: String,
      enum: ["text", "file", "audio", "image"], // Added image and audio types
      default: "text",
    },
    fileUrl: {
      type: String, // Stores the file URL for file messages
      required: function () {
        return this.type === "file" || this.type === "audio" || this.type === "image";
      },
    },
    fileType: {
      type: String, // MIME type of the file (e.g., 'image/jpeg', 'audio/webm')
      required: function () {
        return this.type === "file" || this.type === "audio" || this.type === "image";
      },
    },
    fileName: { 
      type: String, // Original file name
    },
    fileSize: { 
      type: Number, // File size in bytes
    },
    isFile: { 
      type: Boolean, 
      default: false, // Indicates if it's a file message
    },
    fileContent: {
      type: String, // Base64-encoded content for inline previews (optional)
      required: function () {
        return this.type === "image" || this.type === "audio"; // For image/audio preview
      },
    },
  },
  {
    timestamps: true, // To keep track of when messages are sent
  }
);

const Message = mongoose.model("Message", messageModel);
module.exports = Message;
