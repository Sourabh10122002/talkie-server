const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const User = require("../models/User");

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [
        "https://chat-app-client-chi-three.vercel.app"
      ],
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true
    }
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Fetch full user object to have username/email
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error("User not found"));
      }
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.user.id);

    // Add to online users
    onlineUsers.set(socket.user.id.toString(), {
      _id: socket.user._id.toString(), // Explicitly convert to string
      username: socket.user.username,
      email: socket.user.email,
      avatar: socket.user.avatar
    });
    socket.join(socket.user.id.toString());
    io.emit("online_users", Array.from(onlineUsers.values()));

    // Join a channel
    // Join a channel
    socket.on("join_channel", async (channelId) => {
      try {
        const Channel = require("../models/Channel");
        const channel = await Channel.findById(channelId).populate('group');

        if (!channel) {
          console.log(`User ${socket.user.id} tried to join non-existent channel ${channelId}`);
          return;
        }

        // Validate user is member of the group
        // Note: socket.user is the full user string/object from initSocket's middleware
        // But we need to ensure we check the *current* group membership which might be in the DB
        // or we trust the socket.user if it was populated with groups (it wasn't in initSocket)

        // Easier: Check if user id is in channel.group.members
        if (channel.group && !channel.group.members.includes(socket.user.id)) {
          console.log(`User ${socket.user.id} denied access to channel ${channelId} (not in group)`);
          socket.emit("error", { message: "Access denied: You are not a member of this group" });
          return;
        }

        socket.join(channelId);
        console.log(`User ${socket.user.id} joined channel ${channelId} in group ${channel.group ? channel.group.name : 'unknown'}`);
      } catch (error) {
        console.error("Error joining channel:", error);
      }
    });

    // Leave a channel
    socket.on("leave_channel", (channelId) => {
      socket.leave(channelId);
      console.log(`User ${socket.user.id} left channel ${channelId}`);
    });

    // Send message
    socket.on("send_message", async (data) => {
      try {
        const { channelId, content } = data;

        // VERIFY PERMISSIONS
        const Channel = require("../models/Channel");
        const channelDoc = await Channel.findById(channelId).populate('group');

        if (!channelDoc) {
          socket.emit("error", { message: "Channel not found" });
          return;
        }

        if (channelDoc.type === 'private') {
          const isMember = channelDoc.members.some(m => m.toString() === socket.user.id);
          const isOwner = channelDoc.group?.owner.toString() === socket.user.id;
          const isAdmin = channelDoc.group?.admins.some(a => a.toString() === socket.user.id);

          if (!isMember && !isOwner && !isAdmin) {
            socket.emit("error", { message: "You are not a member of this private channel" });
            return;
          }
        }

        // Save to database
        const newMessage = new Message({
          channel: channelId,
          sender: socket.user.id,
          content
        });
        await newMessage.save();

        // Populate sender info for the frontend
        await newMessage.populate('sender', 'username email');

        // Broadcast to the channel
        io.to(channelId).emit("receive_message", newMessage);
      } catch (error) {
        console.error("Error sending message:", error);
      }
    });

    socket.on("typing", (channelId) => {
      socket.to(channelId).emit("typing", {
        userId: socket.user.id,
        username: socket.user.username,
        channelId
      });
    });

    socket.on("stop_typing", (channelId) => {
      socket.to(channelId).emit("stop_typing", {
        userId: socket.user.id,
        channelId
      });
    });

    // Message delivery and read receipts
    socket.on("message_delivered", async (data) => {
      try {
        const { messageId, channelId } = data;
        const message = await Message.findById(messageId);

        if (message && !message.deliveredTo.includes(socket.user.id)) {
          message.deliveredTo.push(socket.user.id);

          // Update overall status if not already read
          if (message.status === 'sent') {
            message.status = 'delivered';
          }

          await message.save();
          await message.populate('sender', 'username email');

          // Notify all channel members about the status update
          io.to(channelId).emit('status_updated', message);
        }
      } catch (error) {
        console.error("Error updating message delivery status:", error);
      }
    });

    socket.on("message_read", async (data) => {
      try {
        const { messageId, channelId } = data;
        const message = await Message.findById(messageId);

        if (message && !message.readBy.includes(socket.user.id)) {
          message.readBy.push(socket.user.id);

          // Also mark as delivered if not already
          if (!message.deliveredTo.includes(socket.user.id)) {
            message.deliveredTo.push(socket.user.id);
          }

          message.status = 'read';
          await message.save();
          await message.populate('sender', 'username email');

          // Notify all channel members about the status update
          io.to(channelId).emit('status_updated', message);
        }
      } catch (error) {
        console.error("Error updating message read status:", error);
      }
    });

    // WebRTC Signaling
    socket.on("call_user", (data) => {
      const { userToCall, signalData, from, name, callType } = data;
      io.to(userToCall).emit("call_user", { signal: signalData, from, name, callType });
    });

    socket.on("answer_call", (data) => {
      io.to(data.to).emit("call_accepted", data.signal);
    });

    socket.on("ice_candidate", (data) => {
      io.to(data.to).emit("ice_candidate", data.candidate);
    });

    socket.on("end_call", (data) => {
      io.to(data.to).emit("end_call");
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.user.id);
      onlineUsers.delete(socket.user.id.toString());
      io.emit("online_users", Array.from(onlineUsers.values()));
    });
  });
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

module.exports = { initSocket, getIO };
