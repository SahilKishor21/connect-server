const mongoose = require("mongoose");
const chat = require("./ChatModel");
 
const messageModal = mongoose.Schema({
    sender : {
        type : mongoose.Schema.Types.ObjectId,
        ref :"User",
    },
    receiver : {
        type : mongoose.Schema.Types.ObjectId,
        ref :"User",
    },
    chat : {
        type : mongoose.Schema.Types.ObjectId,
        ref :"Chat",
    }
},
{
    timeStamp: true,
});

const Message = mongoose.model("Message", messageModal);

