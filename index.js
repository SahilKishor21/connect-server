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
const server = http.createServer(app);

dotenv.config();

const allowedOrigins = [
  "https://connect-chat-online.vercel.app",
  "http://localhost:3000"
];

const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
    transports: ["websocket", "polling"],
  },
});

app.set('io', io);
global.io = io; 

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const userRoutes = require("./Routes/userRoutes");
const chatRoutes = require("./Routes/chatRoutes");
const messageRoutes = require("./Routes/messageRoutes");

app.use("/user", userRoutes);
app.use("/chat", chatRoutes);
app.use("/message", messageRoutes);

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Server is Connected to Database");
  } catch (err) {
    console.error("❌ Server is NOT connected to Database", err.message);
    setTimeout(connectDb, 5000);
  }
};
connectDb();

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use(notFound);
app.use(errorHandler);

// JWT Authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    console.log("❌ Socket auth failed: No token provided");
    return next(new Error("Authentication error: Token required"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔐 JWT decoded successfully:", decoded);
    
    const userId = decoded.id || decoded._id;
    if (!userId) {
      console.error("❌ No user ID found in token");
      console.error("Available token fields:", Object.keys(decoded));
      return next(new Error("Authentication error: Invalid token structure"));
    }

    socket.user = {
      _id: userId.toString(),
      name: decoded.name || decoded.username || 'Unknown User',
      email: decoded.email || ''
    };
    
    console.log("✅ Socket authenticated - User ID:", socket.user._id, "Name:", socket.user.name);
    next();
    
  } catch (error) {
    console.error("❌ JWT verification failed:", error.message);
    if (error.name === 'JsonWebTokenError') {
      return next(new Error("Authentication error: Invalid token"));
    } else if (error.name === 'TokenExpiredError') {
      return next(new Error("Authentication error: Token expired"));
    } else {
      return next(new Error("Authentication error: " + error.message));
    }
  }
});

// Enhanced user tracking with socket references
const activeUsers = new Map(); // userId -> {socketId, name, joinTime, socket}
const activeCalls = new Map(); // callId -> call details

// Helper functions
const getOnlineUsers = () => Array.from(activeUsers.keys());

const addUserOnline = (userId, socket, userName) => {
  const existingUser = activeUsers.get(userId);
  if (existingUser && existingUser.socketId !== socket.id) {
    console.log(`🔄 User ${userName} reconnecting, removing old connection`);
    const oldSocket = existingUser.socket;
    if (oldSocket && oldSocket.connected) {
      oldSocket.disconnect(true);
    }
  }
  
  activeUsers.set(userId, {
    socketId: socket.id,
    socket: socket,
    name: userName,
    joinTime: Date.now()
  });
  
  console.log(`👤 User ${userName} (${userId}) is ONLINE`);
  console.log(`👥 Total users online: ${activeUsers.size}`);
  console.log(`👥 Online user IDs: [${Array.from(activeUsers.keys()).join(', ')}]`);
};

const removeUserOffline = (userId) => {
  const userInfo = activeUsers.get(userId);
  if (userInfo) {
    activeUsers.delete(userId);
    console.log(`👤 User ${userInfo.name} (${userId}) is OFFLINE`);
    console.log(`👥 Total users online: ${activeUsers.size}`);
    console.log(`👥 Online user IDs: [${Array.from(activeUsers.keys()).join(', ')}]`);
  }
};

const debugUserMappings = () => {
  console.log("=== USER MAPPING DEBUG ===");
  console.log("Active users count:", activeUsers.size);
  for (const [userId, userInfo] of activeUsers.entries()) {
    console.log(`  User ${userInfo.name} (${userId}) -> Socket ${userInfo.socketId}`);
  }
  console.log("========================");
};

io.on("connection", (socket) => {
  const userId = socket.user._id;
  const userName = socket.user.name;
  
  console.log("🔌 User connected:", userId, userName, "Socket ID:", socket.id);

  addUserOnline(userId, socket, userName);
  debugUserMappings();
  
  socket.broadcast.emit("user online", {
    userId: userId,
    userName: userName,
    onlineUsers: getOnlineUsers()
  });

  socket.emit("online users", getOnlineUsers());

  socket.on("setup", (userData) => {
    const userIdToJoin = socket.user._id;
    socket.join(userIdToJoin);
    socket.emit("connected");
    console.log("⚙️ User setup completed:", userIdToJoin);
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("🏠 User", userId, "joined chat room:", room);
  });

  socket.on("leave chat", (room) => {
    socket.leave(room);
    console.log("🚪 User", userId, "left chat room:", room);
  });

  socket.on("new message", (newMessageReceived) => {
    console.log("💬 New message received from:", userId);
    
    const chatId = newMessageReceived.chat?._id || newMessageReceived.chatId;
    
    if (!chatId) {
      console.log("❌ No chat ID found in message");
      return;
    }

    console.log("💬 Broadcasting message to chat room:", chatId);
    socket.to(chatId).emit("message received", newMessageReceived);
    console.log("✅ Message broadcasted successfully");
  });

  socket.on("typing", (room) => {
    console.log("⌨️ User typing in room:", room);
    socket.to(room).emit("typing", { room, user: userId });
  });

  socket.on("stop typing", (room) => {
    console.log("⌨️ User stopped typing in room:", room);
    socket.to(room).emit("stop typing", { room, user: userId });
  });

  // ========== FIXED CALL SIGNALING ==========

  socket.on("initiate-call", (data) => {
    const { to, isVideo, callId } = data;
    
    console.log("=== 📞 CALL INITIATED ===");
    console.log("   From:", userId, userName);
    console.log("   To:", to);
    console.log("   Video:", isVideo);
    console.log("   Call ID:", callId);
    console.log("   Current online users:", getOnlineUsers());
    
    if (!to) {
      console.log("❌ No target user specified");
      socket.emit("call-failed", { 
        reason: "Invalid recipient",
        message: "No recipient specified for the call"
      });
      return;
    }

    const targetUser = activeUsers.get(to);
    
    if (!targetUser) {
      console.log("❌ Target user not online:", to);
      console.log("❌ Available users:", Array.from(activeUsers.keys()));
      socket.emit("call-user-offline", { 
        targetId: to,
        targetName: "User",
        reason: "User not online",
        message: "The user you're trying to call is not currently online"
      });
      return;
    }
    
    if (to === userId) {
      console.log("❌ User trying to call themselves");
      socket.emit("call-failed", { 
        reason: "Invalid recipient",
        message: "Cannot call yourself"
      });
      return;
    }
    
    if (!targetUser.socket || !targetUser.socket.connected) {
      console.log("❌ Target user socket disconnected");
      removeUserOffline(to);
      socket.emit("call-user-offline", { 
        targetId: to,
        targetName: targetUser.name,
        reason: "User disconnected",
        message: "The user you're trying to call has disconnected"
      });
      return;
    }
    
    const finalCallId = callId || `${userId}-${to}-${Date.now()}`;
    activeCalls.set(finalCallId, {
      caller: userId,
      callerName: userName,
      callee: to,
      calleeName: targetUser.name,
      callId: finalCallId,
      isVideo,
      status: 'ringing',
      startTime: Date.now()
    });
    
    const callData = {
      from: userId,
      fromName: userName,
      isVideo,
      callId: finalCallId,
      timestamp: Date.now()
    };
    
    console.log("📡 Sending incoming-call to socket:", targetUser.socketId);
    console.log("📡 Call data:", callData);
    
    targetUser.socket.emit("incoming-call", callData);
    
    socket.emit("call-sent", {
      to: to,
      targetName: targetUser.name,
      callId: finalCallId
    });
    
    // Auto-timeout after 30 seconds
    setTimeout(() => {
      const call = activeCalls.get(finalCallId);
      if (call && call.status === 'ringing') {
        console.log("⏰ Call timeout:", finalCallId);
        activeCalls.delete(finalCallId);
        
        const callerUser = activeUsers.get(userId);
        if (callerUser && callerUser.socket && callerUser.socket.connected) {
          callerUser.socket.emit("call-failed", {
            reason: "No answer",
            message: "The call was not answered"
          });
        }
        
        if (targetUser.socket && targetUser.socket.connected) {
          targetUser.socket.emit("call-ended", {
            from: userId,
            reason: "timeout",
            callId: finalCallId
          });
        }
      }
    }, 30000);
    
    console.log("✅ Call initiated successfully");
    console.log("========================");
  });

  // FIXED: Accept call - start WebRTC process
  socket.on("accept-call", (data) => {
    const { to, isVideo, callId } = data;
    
    console.log("=== ✅ CALL ACCEPTED ===");
    console.log("   From:", userId, userName);
    console.log("   To:", to);
    console.log("   Call ID:", callId);
    
    if (callId) {
      const call = activeCalls.get(callId);
      if (call) {
        call.status = 'accepted';
        call.acceptTime = Date.now();
        activeCalls.set(callId, call);
        console.log("   Call status updated to accepted");
      }
    }
    
    const targetUser = activeUsers.get(to);
    
    if (!targetUser || !targetUser.socket || !targetUser.socket.connected) {
      console.log("❌ Caller not available");
      socket.emit("call-failed", {
        reason: "Caller disconnected",
        message: "The caller is no longer available"
      });
      return;
    }
    
    // Send call accepted to caller
    targetUser.socket.emit("call-accepted", {
      from: userId,
      fromName: userName,
      isVideo,
      callId
    });
    
    // FIXED: Tell caller to start WebRTC offer
    setTimeout(() => {
      if (targetUser.socket && targetUser.socket.connected) {
        targetUser.socket.emit("start-webrtc-offer", {
          from: userId,
          callId: callId
        });
      }
    }, 1000);
    
    console.log("✅ Call accepted event sent");
    console.log("========================");
  });

  socket.on("reject-call", (data) => {
    const { to, callId, reason } = data;
    
    console.log("=== ❌ CALL REJECTED ===");
    console.log("   From:", userId);
    console.log("   To:", to);
    console.log("   Call ID:", callId);
    console.log("   Reason:", reason);
    
    if (callId) {
      activeCalls.delete(callId);
    }
    
    const targetUser = activeUsers.get(to);
    if (targetUser && targetUser.socket && targetUser.socket.connected) {
      targetUser.socket.emit("call-rejected", {
        from: userId,
        fromName: userName,
        callId,
        reason: reason || 'rejected'
      });
      console.log("✅ Call rejection sent to:", targetUser.socketId);
    } else {
      console.log("❌ Target user not available for rejection notification");
    }
    
    console.log("========================");
  });

  // WebRTC Signaling - Enhanced
  socket.on("offer", (data) => {
    const { to, offer, callId } = data;
    
    console.log("=== 🤝 WebRTC OFFER ===");
    console.log("   From:", userId, "to", to);
    console.log("   Call ID:", callId);
    
    const targetUser = activeUsers.get(to);
    if (!targetUser || !targetUser.socket || !targetUser.socket.connected) {
      console.log("❌ Target user not found for offer");
      return;
    }
    
    targetUser.socket.emit("offer", {
      from: userId,
      offer,
      callId
    });
    
    console.log("✅ Offer sent to:", targetUser.socketId);
    console.log("========================");
  });

  socket.on("answer", (data) => {
    const { to, answer, callId } = data;
    
    console.log("=== 🤝 WebRTC ANSWER ===");
    console.log("   From:", userId, "to", to);
    console.log("   Call ID:", callId);
    
    if (callId) {
      const call = activeCalls.get(callId);
      if (call) {
        call.status = 'connected';
        call.connectTime = Date.now();
        activeCalls.set(callId, call);
        console.log("   Call status updated to connected");
      }
    }
    
    const targetUser = activeUsers.get(to);
    if (!targetUser || !targetUser.socket || !targetUser.socket.connected) {
      console.log("❌ Target user not found for answer");
      return;
    }
    
    targetUser.socket.emit("answer", {
      from: userId,
      answer,
      callId
    });
    
    console.log("✅ Answer sent to:", targetUser.socketId);
    console.log("========================");
  });

  socket.on("ice-candidate", (data) => {
    const { to, candidate, callId } = data;
    
    console.log("🧊 ICE CANDIDATE from", userId, "to", to);
    
    if (!to) {
      console.log("❌ No target for ICE candidate");
      return;
    }
    
    const targetUser = activeUsers.get(to);
    if (!targetUser || !targetUser.socket || !targetUser.socket.connected) {
      console.log("❌ Target user not found for ICE candidate");
      return;
    }
    
    targetUser.socket.emit("ice-candidate", {
      from: userId,
      candidate,
      callId
    });
    
    console.log("✅ ICE candidate sent to:", targetUser.socketId);
  });

  socket.on("end-call", (data) => {
    const { to, callId } = data || {};
    
    console.log("=== 📵 CALL ENDED ===");
    console.log("   From:", userId);
    console.log("   To:", to);
    console.log("   Call ID:", callId);
    
    let callDuration = null;
    if (callId) {
      const call = activeCalls.get(callId);
      if (call) {
        if (call.connectTime) {
          callDuration = Date.now() - call.connectTime;
          console.log("   Duration:", Math.round(callDuration / 1000), "seconds");
        }
        activeCalls.delete(callId);
      }
    }
    
    if (to) {
      const targetUser = activeUsers.get(to);
      if (targetUser && targetUser.socket && targetUser.socket.connected) {
        targetUser.socket.emit("call-ended", {
          from: userId,
          callId,
          duration: callDuration
        });
        console.log("✅ Call ended event sent to:", targetUser.socketId);
      }
    }
    
    console.log("========================");
  });

  socket.on("get-online-users", () => {
    const userList = [];
    for (const [userId, userInfo] of activeUsers.entries()) {
      userList.push({
        userId: userId,
        name: userInfo.name,
        socketId: userInfo.socketId,
        connected: userInfo.socket && userInfo.socket.connected
      });
    }
    
    socket.emit("online-users-debug", {
      onlineUsers: getOnlineUsers(),
      userSocketMap: userList,
      activeCalls: Array.from(activeCalls.keys()),
      currentUser: {
        id: userId,
        name: userName,
        socketId: socket.id
      }
    });
    
    console.log("🔍 Debug info sent to user:", userId);
    debugUserMappings();
  });

  socket.on("disconnect", (reason) => {
    console.log("=== 🔌 USER DISCONNECTED ===");
    console.log("   User:", userId, userName);
    console.log("   Socket ID:", socket.id);
    console.log("   Reason:", reason);
    
    removeUserOffline(userId);
    
    for (const [callId, call] of activeCalls.entries()) {
      if (call.caller === userId || call.callee === userId) {
        console.log("📵 Auto-ending call due to disconnect:", callId);
        
        const otherUserId = call.caller === userId ? call.callee : call.caller;
        const otherUser = activeUsers.get(otherUserId);
        
        if (otherUser && otherUser.socket && otherUser.socket.connected) {
          otherUser.socket.emit("call-ended", {
            from: userId,
            callId,
            reason: "disconnect"
          });
          console.log("📵 Notified other user about call end:", otherUserId);
        }
        
        activeCalls.delete(callId);
      }
    }
    
    socket.broadcast.emit("user offline", {
      userId: userId,
      userName: userName,
      onlineUsers: getOnlineUsers()
    });
    
    console.log("👥 Users remaining online:", activeUsers.size);
    console.log("📞 Active calls remaining:", activeCalls.size);
    console.log("========================");
  });

  socket.on("error", (error) => {
    console.error("🚨 Socket error for user", userId, ":", error);
  });
});

setInterval(() => {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000;
  
  let cleanedCalls = 0;
  let cleanedUsers = 0;
  
  for (const [callId, call] of activeCalls.entries()) {
    if (now - call.startTime > staleThreshold) {
      console.log("🧹 Cleaning up stale call:", callId);
      activeCalls.delete(callId);
      cleanedCalls++;
    }
  }
  
  for (const [userId, userInfo] of activeUsers.entries()) {
    if (!userInfo.socket || !userInfo.socket.connected) {
      console.log("🧹 Cleaning up disconnected user:", userId, userInfo.name);
      activeUsers.delete(userId);
      cleanedUsers++;
    }
  }
  
  if (cleanedCalls > 0 || cleanedUsers > 0) {
    console.log(`🧹 Cleanup complete. Removed ${cleanedCalls} calls, ${cleanedUsers} users`);
    console.log(`📊 Current state: ${activeCalls.size} active calls, ${activeUsers.size} online users`);
  }
}, 5 * 60 * 1000);

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("📞 Enhanced call signaling ready");
  console.log("👥 User tracking with socket references initialized");
  console.log("🔒 JWT authentication enabled");
  console.log("💬 Real-time messaging ready");
  console.log("🔍 Debug endpoints available");
});