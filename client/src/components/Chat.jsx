import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import api from "../api/axios";

// Accessing the Vite env variable for Socket
const socket = io(import.meta.env.VITE_SOCKET_URL, {
  withCredentials: true,
});

function Chat({ user }) {
  const scrollRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [room, setRoom] = useState("Global");
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState([]);
  const [notifications, setNotifications] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [whoIsTyping, setWhoIsTyping] = useState("");

  // Fetch users for the sidebar
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get("/auth/users");
        setUsers(res.data);
      } catch (err) {
        console.error("Failed to fetch users");
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, whoIsTyping]);

  // Handle Room Switching
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // room is either 'Global' or 'id1_id2'
        const response = await api.get(`/auth/messages/${room}`);
        setChat(response.data);
      } catch (err) {
        console.error("Could not load history");
      }
    };

    fetchHistory();
    socket.emit("join_room", room);

    const handleNewMessage = (data) => {
      // If the message is NOT for the current room, increment notification
      if (data.room !== room) {
        // Determine which user sent it (assuming room name contains IDs)
        const senderId = data.senderId;
        setNotifications((prev) => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1,
        }));
      } else {
        setChat((prev) => [...prev, data]);
      }
    };

    socket.on("receive_msg", handleNewMessage);

    // Listen for the typing event
    socket.on("display_typing", (data) => {
      if (data.room === room) {
        setWhoIsTyping(`${data.username} is typing`);
      }
    });

    socket.on("hide_typing", (data) => {
      if (data.room === room) {
        setWhoIsTyping("");
      }
    });

    return () => {
      socket.off("receive_msg");
      socket.off("display_typing");
      socket.off("hide_typing");
    };
  }, [room]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
      window.location.reload(); // Re-renders App.js and shows Login
    } catch (err) {
      console.error("Logout failed");
    }
  };

  const startPersonalChat = (otherUser) => {
    // Create a unique room ID by sorting IDs alphabetically
    const roomID = [user.id, otherUser._id].sort().join("_");
    setRoom(roomID);

    setNotifications((prev) => ({
      ...prev,
      [otherUser._id]: 0,
    }));
  };

  const send = () => {
    if (msg.trim() === "") return;

    const data = {
      room,
      senderId: user.id,
      senderName: user.username,
      text: msg,
    };
    socket.emit("send_msg", data);

    // Immediately tell others you stopped typing
    socket.emit("stop_typing", { room });
    setIsTyping(false);
    clearTimeout(window.typingTimeout);

    setMsg("");
  };

  const handleInputChange = (e) => {
    setMsg(e.target.value);

    // Emit typing event
    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", { room, username: user.username });
    }

    // Stop typing after 2 seconds of no activity
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      setIsTyping(false);
      socket.emit("stop_typing", { room });
    }, 2000);
  };

  return (
    <div
      style={{
        display: "flex",
        maxWidth: 850,
        height: "100vh",
        fontFamily: "Arial",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: "250px",
          borderRight: "1px solid #ccc",
          padding: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3>Chats</h3>
          <span style={{ cursor: "pointer" }} onClick={handleLogout}>
            Logout
          </span>
        </div>
        <button
          onClick={() => setRoom("Global")}
          style={{ width: "100%", marginBottom: "10px", cursor: "pointer" }}
        >
          🌍 Global Group
        </button>
        <hr />
        <h4>Users</h4>
        {users.map((u) => (
          <div
            key={u._id}
            onClick={() => startPersonalChat(u)}
            style={{
              padding: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: room.includes(u._id) ? "#e0e0e0" : "transparent",
              color: room.includes(u._id) ? "#000" : "#fff",
            }}
          >
            <span>{u.username}</span>
            {notifications[u._id] > 0 && (
              <span
                style={{
                  background: "red",
                  color: "white",
                  borderRadius: "50%",
                  padding: "2px 6px",
                  marginLeft: "5px",
                }}
              >
                {notifications[u._id]}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Main Chat Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "20px",
        }}
      >
        <h2>Room: {room === "Global" ? "Global Group" : "Private Message"}</h2>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            border: "1px solid #eee",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          {chat.map((c, i) => {
            // Check if the previous message was sent by the same person
            const isSameSender = i > 0 && chat[i - 1].senderId === c.senderId;
            const isMe = c.senderId === user.id;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMe ? "flex-end" : "flex-start",
                  marginTop: isSameSender ? "2px" : "12px", // Less space between grouped messages
                }}
              >
                {/* 1. Show Name ONLY if it's the first message of a group and NOT me */}
                {!isSameSender && !isMe && (
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      marginBottom: "5px",
                      color: "#555",
                    }}
                  >
                    {c.senderName}
                  </span>
                )}
                {/* 2. Message Bubble */}
                <div
                  style={{
                    position: "relative",
                    backgroundColor: isMe ? "#007bff" : "#fff",
                    color: isMe ? "white" : "black",
                    padding: "8px 12px",
                    borderRadius: "15px",
                    // If it's the first message, give it a sharp corner (the "arrow")
                    borderTopRightRadius:
                      isMe && !isSameSender ? "2px" : "15px",
                    borderTopLeftRadius:
                      !isMe && !isSameSender ? "2px" : "15px",
                    maxWidth: "70%",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  }}
                >
                  {c.text}
                </div>
              </div>
            );
          })}

          {/* TYPING INDICATOR AREA */}
          {whoIsTyping && (
            <div style={{ textAlign: "left", margin: "5px" }}>
              <div className="typing-dots">{whoIsTyping}</div>
            </div>
          )}

          {/* Invisible div for auto-scroll */}
          <div ref={scrollRef} />
        </div>

        <div style={{ display: "flex", marginTop: "10px" }}>
          <input
            style={{ flex: 1, padding: "10px" }}
            value={msg}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message..."
          />
          <button
            onClick={send}
            style={{ padding: "10px 20px", cursor: "pointer" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
