const { default: mongoose } = require("mongoose");

const mongoose = require("mongoose");
const chatModel = mongoose.Schema({
    chatName : {type : string},
    isGroupChat : {type : boolean},
    users : [
        {
            type : mongoose.Schema.Types.ObjectId,   // giving id to user
            ref : "User",
         }
    ],
    lastMessage : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Message",
    },
    groupAdmin : {
        type : mongoose.Schema.Types.ObjectId,
        ref :"User",
    },
},
{
    timeStamp: true,
});

const Chat = mongoose.model("Chat", chatModel);
module.exports = Chat;