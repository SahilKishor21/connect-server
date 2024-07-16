const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require('body-parser')
const mongoose = require("mongoose");
const userRoutes = require("./Routes/userRoutes");
const app = express(); 
const port = 5000;
dotenv.config();
app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }))


app.use(express.json());

const connectDb = async () => {
  try {
   await mongoose.connect(process.env.MONGO_URI);
    console.log("Server is connected to Database");
  } catch (error) {
    console.log("Server is not connected to the Database", error.message);
  }


};

connectDb();

app.get("/", (req,res) =>
  {res.send("All good");}
);

app.use("/user", userRoutes);


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });