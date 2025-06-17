const mongoose = require("mongoose");
const chat = require("./ChatModel");

const messageModal = mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false, 
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", 
        required: false, 
    },
    content: {
        type: String,
        required: true,
    },
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chat",
        required: true,
    },
    
    isFile: {
        type: Boolean,
        default: false,
    },
    fileType: {
        type: String,
    },
    fileName: {
        type: String,
    },
    fileContent: {
        type: String,
    },
  
    isNotification: {
        type: Boolean,
        default: false,
    },
    notificationType: {
        type: String,
        enum: ['group_leave', 'group_join', 'group_created', 'user_added', 'user_removed', 'admin_changed'],
        required: false,
    },
   
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    deliveredTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
}, {
    timestamps: true, 
});

const Message = mongoose.model("Message", messageModal);

module.exports = Message;