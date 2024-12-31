const express = require("express");
const dotenv = require("dotenv");
const { default: mongoose } = require("mongoose");
const app = express();
const cors = require("cors");
const path = require("path");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const http = require("http");
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");


const server = http.createServer(app);

const io = socketIO(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(
  cors({
    origin: "https://connect-chi-inky.vercel.app/",
  })
);
dotenv.config();

app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const userRoutes = require("./Routes/userRoutes");
const chatRoutes = require("./Routes/chatRoutes");
const messageRoutes = require("./Routes/messageRoutes");

const connectDb = async () => {
  try {
    const connect = await mongoose.connect(process.env.MONGO_URI);
    console.log("Server is Connected to Database");
  } catch (err) {
    console.log("Server is NOT connected to Database", err.message);
  }
};
connectDb();

app.get("/", (req, res) => {
  res.send("API is running123");
});

app.use("/user", userRoutes);
app.use("/chat", chatRoutes);
app.use("/message", messageRoutes);

// Error Handling middlewares
app.use(notFound);
app.use(errorHandler);

// Store active users
const activeUsers = new Map();

// Socket.io middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token not provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.user._id);
  
  // Store user's socket id
  activeUsers.set(socket.user._id, socket.id);

  // Join a room (can be used for private chats)
  socket.on('join chat', (room) => {
    socket.join(room);
    console.log('User joined room:', room);
  });

  
  socket.on('call-offer', (data) => {
    const targetSocketId = activeUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-offer', {
        offer: data.offer,
        from: socket.user._id,
        isVideo: data.isVideo
      });
    }
  });

  socket.on('call-answer', (data) => {
    const targetSocketId = activeUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-answer', {
        answer: data.answer,
        from: socket.user._id
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const targetSocketId = activeUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.user._id
      });
    }
  });

  socket.on('end-call', (data) => {
    const targetSocketId = activeUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-ended', {
        from: socket.user._id
      });
    }
  });

  // Handle messages
  socket.on('new message', (newMessageReceived) => {
    var chat = newMessageReceived.chat;

    if (!chat.users) return console.log('Chat.users not defined');

    chat.users.forEach((user) => {
      if (user._id === newMessageReceived.sender._id) return;

      const targetSocketId = activeUsers.get(user._id);
      if (targetSocketId) {
        io.to(targetSocketId).emit('message received', newMessageReceived);
      }
    });
  });

  // Handle typing events
  socket.on('typing', (room) => socket.in(room).emit('typing'));
  socket.on('stop typing', (room) => socket.in(room).emit('stop typing'));

  
  socket.on('disconnect', () => {
    activeUsers.delete(socket.user._id);
    console.log('User disconnected:', socket.user._id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, console.log("Server is Running..."));