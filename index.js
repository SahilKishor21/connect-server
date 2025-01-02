const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const http = require("http");
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");

const app = express();
app.set('io', io);
const server = http.createServer(app);

dotenv.config();

defaultOrigins = [
  "https://connect-chat-online.vercel.app",
  "http://localhost:3000"
];

const allowedOrigins = [
  "https://connect-chat-online.vercel.app",
  "http://localhost:3000"
];

app.options("*", cors()); 

const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// Static file handling
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const userRoutes = require("./Routes/userRoutes");
const chatRoutes = require("./Routes/chatRoutes");
const messageRoutes = require("./Routes/messageRoutes");

// MongoDB connection
const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Server is Connected to Database");
  } catch (err) {
    console.error("Server is NOT connected to Database", err.message);
    process.exit(1);
  }
};
connectDb();

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/user", userRoutes);
app.use("/chat", chatRoutes);
app.use("/message", messageRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Socket.io middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: Token not provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    return next(new Error("Authentication error: Invalid token"));
  }
});

// Socket.io connection handling
const activeUsers = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.user._id);

  // Store user's socket ID
  activeUsers.set(socket.user._id, socket.id);

  // Emit online status to all users
  io.emit("user online", socket.user._id);

  // Join user to their active chats
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
  });

  // Join a chat room
  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User joined room:", room);
  });

  // Leave a chat room
  socket.on("leave chat", (room) => {
    socket.leave(room);
    console.log("User left room:", room);
  });

  // New message handling
  socket.on("new message", (newMessageReceived) => {
    var chat = newMessageReceived.chat;

    if (!chat.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id === newMessageReceived.sender._id) return;

      // Emit to user's socket ID if online
      const targetSocketId = activeUsers.get(user._id);
      if (targetSocketId) {
        io.to(targetSocketId).emit("message received", newMessageReceived);
      }

      // Also emit to the chat room
      socket.in(chat._id).emit("message received", newMessageReceived);
    });
  });

  // Group chat message handling
  socket.on("new group message", (message) => {
    const chat = message.chat;
    
    if (!chat.isGroupChat) return;

    // Broadcast to all users in the group except sender
    socket.to(chat._id).emit("group message received", message);
  });

  // Typing indicators
  socket.on("typing", (room) => {
    socket.in(room).emit("typing", {
      room: room,
      user: socket.user._id
    });
  });

  socket.on("stop typing", (room) => {
    socket.in(room).emit("stop typing", {
      room: room,
      user: socket.user._id
    });
  });

 
  socket.on("call-offer", (data) => {
    const targetSocketId = activeUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-offer", {
        offer: data.offer,
        from: socket.user._id,
        isVideo: data.isVideo,
      });
    }
  });

  socket.on("call-answer", (data) => {
    const targetSocketId = activeUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-answer", {
        answer: data.answer,
        from: socket.user._id,
      });
    }
  });

  socket.on("ice-candidate", (data) => {
    const targetSocketId = activeUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", {
        candidate: data.candidate,
        from: socket.user._id,
      });
    }
  });

  socket.on("end-call", (data) => {
    const targetSocketId = activeUsers.get(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-ended", {
        from: socket.user._id,
      });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    // Remove user from active users
    activeUsers.delete(socket.user._id);
    
    // Emit offline status to all users
    io.emit("user offline", socket.user._id);
    
    console.log("User disconnected:", socket.user._id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}...`));