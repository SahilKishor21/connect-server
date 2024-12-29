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
<<<<<<< HEAD
      trim: true, // Text content, used for regular text messages
=======
      trim: true,
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
    },
    type: {
      type: String,
<<<<<<< HEAD
      enum: ["text", "file", "audio", "image"], // Added image and audio types
=======
      enum: ["text", "file"], // Distinguishes between text and file messages
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
      default: "text",
    },
    fileUrl: {
      type: String, // Stores the file URL for file messages
      required: function () {
<<<<<<< HEAD
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
=======
        return this.type === "file";
      },
    },
    isFile: { type: Boolean, default: false },
    fileName: { type: String }, // Original file name
    fileSize: { type: Number }, // File size in bytes
    fileContent: {
      type: String, // Base64-encoded content for inline previews
      required: function () {
        return this.type === "file";
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
      },
    },
  },
  {
<<<<<<< HEAD
    timestamps: true, // To keep track of when messages are sent
=======
    timestamps: true, // Corrected option name
>>>>>>> 76e2c44 (updated FileUploadiing Functionality)
  }
);

const Message = mongoose.model("Message", messageModel);
module.exports = Message;
