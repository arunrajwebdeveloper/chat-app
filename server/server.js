require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const Message = require("./models/Message");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

mongoose.connect(process.env.MONGO_URI);

app.use("/api/auth", authRoutes);

// Socket.io logic
// Socket.io Middleware for Handshake Auth
io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) return next(new Error("Authentication error"));

  const cookies = cookie.parse(cookieHeader);
  const token = cookies.accessToken;

  if (!token) return next(new Error("Authentication error"));

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) return next(new Error("Token expired"));
    socket.user = decoded; // Attach user info to the socket
    next();
  });
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.user.name}`);

  socket.on("join_room", (room) => {
    socket.join(room);
  });

  socket.on("send_msg", async (data) => {
    const newMessage = new Message(data);
    const savedMsg = await newMessage.save();
    io.to(data.room).emit("receive_msg", savedMsg);
  });

  socket.on("typing", (data) => {
    socket.to(data.room).emit("display_typing", data);
  });

  socket.on("stop_typing", (data) => {
    socket.to(data.room).emit("hide_typing", data);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server running on ${PORT}`));
