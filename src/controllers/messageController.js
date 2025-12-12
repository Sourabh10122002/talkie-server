const Message = require('../models/Message');
const { getIO } = require('../sockets/chat.socket');

exports.getMessages = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const messages = await Message.find({ channel: channelId })
            .sort({ timestamp: -1 }) // Newest first
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('sender', 'username email') // Populate sender info
            .lean();

        // Reverse to show oldest first in chat view, but we fetched newest first for pagination
        res.status(200).json(messages.reverse());
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error fetching messages' });
    }
};

// Note: Sending messages will primarily happen via Socket.io, 
// but an API endpoint can be useful for fallback or specific use cases.
exports.createMessage = async (req, res) => {
    try {
        const { channelId, content } = req.body;
        const senderId = req.userId; // Assuming auth middleware adds user to req

        const newMessage = new Message({
            channel: channelId,
            sender: senderId,
            content
        });

        await newMessage.save();

        // Ideally, we should emit a socket event here too if using REST for sending
        // const io = require('../sockets/chat.socket').getIO();
        // io.to(channelId).emit('receive_message', await newMessage.populate('sender', 'username'));

        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Server error sending message' });
    }
}

exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.userId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (message.sender.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to delete this message' });
        }

        await Message.findByIdAndDelete(messageId);

        // Emit socket event
        const io = getIO();
        io.to(message.channel.toString()).emit('message_deleted', messageId);

        res.status(200).json({ message: 'Message deleted successfully', messageId });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ message: 'Server error deleting message' });
    }
};

exports.editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = req.userId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (message.sender.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to edit this message' });
        }

        message.content = content;
        await message.save();
        await message.populate('sender', 'username email');

        // Emit socket event
        const io = getIO();
        io.to(message.channel.toString()).emit('message_updated', message);

        res.status(200).json(message);
    } catch (error) {
        console.error('Error editing message:', error);
        res.status(500).json({ message: 'Server error editing message' });
    }
};

exports.searchMessages = async (req, res) => {
    try {
        const { query, channelId } = req.query;

        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const filter = {
            content: { $regex: query, $options: 'i' } // Case-insensitive search
        };

        if (channelId) {
            filter.channel = channelId;
        }

        const messages = await Message.find(filter)
            .populate('sender', 'username email')
            .sort({ timestamp: -1 })
            .limit(50);

        res.status(200).json(messages);
    } catch (error) {
        console.error('Error searching messages:', error);
        res.status(500).json({ message: 'Server error searching messages' });
    }
};

exports.updateMessageStatus = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { status, userId } = req.body;
        const currentUserId = req.userId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Update status based on the action
        if (status === 'delivered' && !message.deliveredTo.includes(currentUserId)) {
            message.deliveredTo.push(currentUserId);

            // Update overall status if not already read
            if (message.status === 'sent') {
                message.status = 'delivered';
            }
        } else if (status === 'read' && !message.readBy.includes(currentUserId)) {
            message.readBy.push(currentUserId);

            // Also mark as delivered if not already
            if (!message.deliveredTo.includes(currentUserId)) {
                message.deliveredTo.push(currentUserId);
            }

            message.status = 'read';
        }

        await message.save();
        await message.populate('sender', 'username email');

        // Emit socket event to notify sender
        const io = getIO();
        io.to(message.channel.toString()).emit('status_updated', message);

        res.status(200).json(message);
    } catch (error) {
        console.error('Error updating message status:', error);
        res.status(500).json({ message: 'Server error updating message status' });
    }
};

exports.markMessagesAsRead = async (req, res) => {
    try {
        const { channelId } = req.body;
        const userId = req.userId;

        // Find all messages in the channel that are not sent by this user and not already read
        const messages = await Message.find({
            channel: channelId,
            sender: { $ne: userId },
            readBy: { $ne: userId }
        });

        const io = getIO();

        for (const message of messages) {
            // Add user to readBy array
            if (!message.readBy.includes(userId)) {
                message.readBy.push(userId);
            }

            // Add user to deliveredTo array if not already there
            if (!message.deliveredTo.includes(userId)) {
                message.deliveredTo.push(userId);
            }

            message.status = 'read';
            await message.save();
            await message.populate('sender', 'username email');

            // Emit status update for each message
            io.to(channelId).emit('status_updated', message);
        }

        res.status(200).json({ message: 'Messages marked as read', count: messages.length });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ message: 'Server error marking messages as read' });
    }
};
