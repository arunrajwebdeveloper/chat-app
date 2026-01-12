require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
// const mongoSanitize = require("express-mongo-sanitize");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const socketHandler = require("./socket/socketHandler");
const socketAuth = require("./socket/socketMiddleware");

const app = express();
const server = http.createServer(app);

// Initialize DB
connectDB();

// Trust proxy is essential for secure cookies on services like Render/Heroku
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});

// Set security-related HTTP headers
app.use(helmet());

// Enable CORS for your frontend
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// Parse JSON bodies (Must come before mongoSanitize)
// Added a limit to prevent large payload attacks
app.use(express.json({ limit: "10kb" }));

// Parse cookies (Must come before auth routes)
app.use(cookieParser());

// Sanitize data against NoSQL Injection
// Clean the body, but don't force-overwrite the query/params if they are read-only
// app.use(
//   mongoSanitize({
//     replaceWith: "_",
//     allowDots: true, // Optional: allows you to use dots in keys if needed
//     onSanitize: ({ req, key }) => {
//       console.warn(
//         `[Sanitize] This request contained forbidden characters in: ${key}`
//       );
//     },
//   })
// );

// manually sanitize just the body
// app.use((req, res, next) => {
//   if (req.body) {
//     req.body = mongoSanitize.sanitize(req.body);
//   }
//   next();
// });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per window
  message: "Too many login attempts, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRoutes);

// Socket
io.use(socketAuth);
socketHandler(io);

// ERROR HANDLING (Last Middleware)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5010;
server.listen(PORT, () =>
  console.log(
    `Server running in ${
      process.env.NODE_ENV || "development"
    } mode on port ${PORT}`
  )
);
