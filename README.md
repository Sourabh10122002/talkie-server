# Chat App — Server (Node.js + Express + Socket.io)

This is the **backend** for the real-time chat application.  
It manages authentication, channels, message storage, pagination, online presence, and WebRTC signaling for audio/video calls.

---

## 🚀 Core Features (Server)
- User authentication (JWT)  
- REST APIs for messages, channels, and search  
- Load **recent messages** when a chat opens  
- Upward pagination (fetch older messages on scroll-up)  
- Real-time messaging with Socket.io  
- Real-time online/offline status  
- Message status updates (Sent / Delivered / Seen)  
- WebRTC signaling for voice and video calls  

---

## ⭐ Optional Features (Implemented)
> These advanced features were added on top of the required functionality.

- **Private channels support**  
- **Typing indicators (Socket.io events)**  
- **Message editing** (PATCH API + Socket event)  
- **Message deletion** (soft delete logic)  
- **Message search** (MongoDB text index)  
- **Voice Call (WebRTC signaling)**  
- **Video Call (WebRTC signaling)**  

---

## 🛠️ Tech Stack
- Node.js  
- Express.js  
- MongoDB + Mongoose  
- Socket.io  
- JWT Authentication  
- Multer / Cloudinary (optional for file upload)  

---

## 📦 Setup & Installation

### Navigate to backend folder
cd server

### Install dependencies
npm install

### Start the backend server
npm run dev

server/
│── controllers/
│── models/
│── routes/
│── sockets/
│── middleware/
│── utils/
└── server.js


## 📌 Assumptions & Limitations

- WebRTC is implemented only for 1-to-1 calls, not group calls  
- Pagination loads messages in batches  
- Search depends on MongoDB text indices  
- Media/file sharing is optional and not required for core functionality  
- Message delete is soft-delete (content removed but metadata retained)  

