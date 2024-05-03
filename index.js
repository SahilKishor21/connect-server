const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const userRoutes = require("./Routes/userRoutes");
const app = express(); 
const port = 5000;
dotenv.config();

const connectDb = async () => {
  try {
    const connect = await mongoose.connect(process.env.MONGO_URI);
    console.log("Server is connected to Database");
  } catch (error) {
    console.log("Server is not connected to the Database", error.message);
  }

  app.use("user/", userRoutes);
};

connectDb();




app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });