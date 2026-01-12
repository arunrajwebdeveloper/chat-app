const cookie = require("cookie");
const jwt = require("jsonwebtoken");

// Socket.io Middleware for Handshake Auth
const socketAuth = (socket, next) => {
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
};

module.exports = socketAuth;
