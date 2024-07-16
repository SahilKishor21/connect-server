const express = require("express");
const User = require("../models/userModel");
const generateToken = require("../Config/generateToken");
const expressAsyncHandler = require("express-async-handler");


const loginController = expressAsyncHandler( async (req,res) => {
    const {name, email,password} = req.body;
    const user = await UserModel.findone({name});
    console.log("fetched users Data", user);
    console.log(await user.matchPassword(password));
    if (user&&(await user.matchPassword(password)))
    {
       const response = res.json({
            _id: user._id,
            name : user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
        console.log(response);
    }
    else{
        res.status(401);
        throw new Error("Invalid userName or Password");
    }

})


//REGISTRATION
const registerController = expressAsyncHandler(async (req, res) => {
    console.log(req.body);
    const { name, email, password } = req.body;

    //check
    if(!name || !email || !password  ){
        res.send(400);
        throw Error("All necessory input fields have not been filled");
    }

    //Already a user
     const Userexist = await User.find({ email });
    if (Userexist){
        throw new Error("User already exists");
    } 

    //Name not available 
     const userNameExist = await User.find({ name });
    if (userNameExist){
        throw new Error("UserName already taken");
    }

    // adding user to Database
    const user = await User.create({name, email, password });
    if (user){
        res.status(201).json({
            _id: user._id,
            name : user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
    }
    else{
        res.status(400);
        throw new Error("Registration Error");
    }

    //
});
const fetchAllUsersController = expressAsyncHandler(async (req, res) => {
    const keyword = req.query.search
    ? {
        $or: [
            {name: {$regex: req.query.search, $options: "1"} },
            {email: {$regex: req.query.search, $options: "1"} },
        ],
     }
    : {};

    const users = await UserModel.find(keyword).find({
        _id: {$ne: req.user._id},
    });
    res.send(users);
});

module.exports = { loginController, registerController, fetchAllUsersController};

