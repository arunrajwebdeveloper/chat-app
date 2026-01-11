const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/authMiddleware");
const User = require("../models/User");
const Message = require("../models/Message");

const cookieOptions = {
  httpOnly: true,
  secure: false, // Set to true in production
  sameSite: "Lax",
};

router.post("/register", async (req, res) => {
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const newUser = new User({
    username: req.body.username,
    password: hashedPassword,
  });
  await newUser.save();
  res.status(201).json("User Registered");
});

router.post("/login", async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(400).json("Invalid Credentials");
  }

  const accessToken = jwt.sign(
    { id: user._id, name: user.username },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );
  const refreshToken = jwt.sign(
    { id: user._id, name: user.username },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ id: user._id, username: user.username });
});

router.post("/refresh", (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json("Expired");

  jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json("Invalid");
    const newAccess = jwt.sign(
      { id: user.id, name: user.name },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );
    res.cookie("accessToken", newAccess, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });
    res.json("Refreshed");
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});

// Get current user profile based on accessToken cookie
router.get("/me", verifyToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.name });
});

router.get("/users", verifyToken, async (req, res) => {
  try {
    // Fetch all users except the currently logged-in one
    const users = await User.find({ _id: { $ne: req.user.id } }).select(
      "username _id"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json("Error fetching users");
  }
});

/**
 * GET ROOM HISTORY
 * This fetches the last 50 messages for a specific room.
 */
router.get("/messages/:room", verifyToken, async (req, res) => {
  try {
    const { room } = req.params;

    // Authorization check: If it's a private room, ensure the user belongs to it
    if (room.includes("_") && !room.includes(req.user.id)) {
      return res.status(403).json("You are not authorized to view this chat.");
    }

    const messages = await Message.find({ room })
      .sort({ createdAt: 1 })
      .limit(50);

    res.json(messages);
  } catch (err) {
    res.status(500).json("Error fetching messages");
  }
});

module.exports = router;
