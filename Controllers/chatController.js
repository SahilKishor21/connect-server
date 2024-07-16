const asyncHandler = require("express-async-handler");
const Chat  = require("../models/ChatModel");
const User = require("../models/userModel");
const { Error } = require("mongoose");

const accessChat = asyncHandler(async (req, res) =>{
    const {userId} = req.body;
    
    if(!userId) {
        console.log("UserId param not sent with request");
        return res.sendStatus(400);
    } 

    var isChat = await Chat.find({
        isGroupChat: false,
        $and: [
            { users: { $elematch: {$eq: req.user._id}}},
            { users: { $elematch: {$eq: userId }} },
        ],
        
    })
    .populate("users", "-password")
    .populate("lastMessage");

    isChat = await User.populate(isChat, {
        path: "lastMessage.sender",
        select: "name email",
    });

    if(isChat.length > 0) {
        res.send(isChat[0]);
    } else{
        var chatData = {
            chatName: "sender",
            isGroupchat: false,
            users: [req.user._id, userId],
        };
        try {
            const createChat =await Chat.create(chatData);
            const FullChat  = await Chat.findOne({_id: createChat._id},
            "users",
            "-password"
            );
            res.status(200).json(FullChat);
        } catch(error){
            res.status(400);
            throw new Error(error.message);
        }
    }
    
});

const fetchChats = asyncHandler(async(req, res) => {
    try{
        Chat.find({ user: {$elematch:{$eq: req.user._id}}})
        .populate("users", "-password")
        .populate("groupAdmin", "-password")
        .populate("lastMessage")
        .sort({ updateAt : -1})
        .then(async (results)=>{
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

const fetchGroups =asyncHandler(async (req, res)=>{
    try{
        const allGroups = await Chat.where("isGroupchat").equals(true);
        res.status(200).send(allGroups);
    } catch(error) {
        res.status(400);
        throw new Error(error.message);
    }
});

const createGroupChat = asyncHandler(async (req, res) => {
    if(!req.body.users || !req.body.name) {
        return res.status(400).send({message: "Data is insufficient"});
    }

    var users = json.parse(req.body.users);
    console.log("chatController/createGroupd: ", req);
    users.push(req.user);

    try{
        const groupChat = await Chat.create({
            chatName: req.body.name,
            users: users,
            isGroupchat: true,
            groupAdmin: req.user,
        });

        const fullGroupChat = await Chat.findOne({_id: groupChat._id })
         .populate("users", "-password")
         .populate("groupAdmin", "-password");

        res.status(200).json(fullGroupChat); 
    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
});

const groupExit = asyncHandler( async (req, res)=> {
    const {chatId, userId} = req.body;

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

module.exports = {
    accessChat,
    fetchChats,
    fetchGroups,
    createGroupChat,
    groupExit,
};
