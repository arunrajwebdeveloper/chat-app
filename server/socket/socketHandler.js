const Message = require("../models/Message");

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.name}`);

    socket.on("join_room", (room) => {
      socket.join(room);
    });

    socket.on("send_msg", async (data) => {
      if (data.text.length > 1000)
        return socket.emit("error", "Message too long");

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
};

module.exports = socketHandler;
