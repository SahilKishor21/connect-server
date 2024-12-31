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
      required: true, 
    },
    content: {
      type: String,
      trim: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
    },
    type: {
      type: String,
      enum: ["text", "file", "audio", "image"], 
      default: "text",
    },
    fileUrl: {
      type: String, 
      required: function () {
        return this.type === "file" || this.type === "audio" || this.type === "image";
      },
    },
    fileType: {
      type: String, 
      required: function () {
        return this.type === "file" || this.type === "audio" || this.type === "image";
      },
    },
    fileName: { 
      type: String, 
    },
    fileSize: { 
      type: Number, 
    },
    isFile: { 
      type: Boolean, 
      default: false, 
    },
    fileContent: {
      type: String, 
      required: function () {
        return this.type === "image" || this.type === "audio"; 
      },
    },
  },
  {
    timestamps: true, 
  }
);

const Message = mongoose.model("Message", messageModel);
module.exports = Message;
