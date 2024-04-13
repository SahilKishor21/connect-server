 const mongoose = require("mongoose");

 const userModel = mongoose.Schema({
    name : {
        type: string,
        required: true,
    },
    email : {
        type: string,
        required: true,
    },
    password : {
        type: string,
        required: true,
    },
 },
 {
    timeStamp: true,
});

const User = mongoose.Model("User", userModel);
Module.export = User;