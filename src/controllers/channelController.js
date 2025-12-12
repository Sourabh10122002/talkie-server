const Channel = require('../models/Channel');

exports.getChannels = async (req, res) => {
    try {
        const userId = req.userId;
        const channels = await Channel.find({
            $or: [
                { type: 'public' },
                { members: userId }
            ]
        }).populate('members', 'username email');
        res.status(200).json(channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ message: 'Server error fetching channels' });
    }
};

exports.createChannel = async (req, res) => {
    try {
        const { name, description, type = 'public', members = [] } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Channel name is required' });
        }

        const existingChannel = await Channel.findOne({ name });
        if (existingChannel) {
            return res.status(400).json({ message: 'Channel already exists' });
        }

        // Ensure creator is always a member
        const initialMembers = [...new Set([...members, req.userId])];

        const newChannel = new Channel({
            name,
            description,
            type,
            members: initialMembers
        });

        await newChannel.save();
        // Populate members to match getChannels structure
        await newChannel.populate('members', 'username email');

        res.status(201).json(newChannel);
    } catch (error) {
        console.error('Error creating channel:', error);
        res.status(500).json({ message: 'Server error creating channel' });
    }
};

exports.joinChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.userId;

        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        if (channel.type === 'private') {
            return res.status(403).json({ message: 'Cannot join private channel directly' });
        }

        if (channel.members.includes(userId)) {
            return res.status(400).json({ message: 'User already in channel' });
        }

        channel.members.push(userId);
        await channel.save();
        await channel.populate('members', 'username email');

        res.status(200).json(channel);
    } catch (error) {
        console.error('Error joining channel:', error);
        res.status(500).json({ message: 'Server error joining channel' });
    }
};

exports.leaveChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.userId;

        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        channel.members = channel.members.filter(member => member.toString() !== userId);
        await channel.save();
        await channel.populate('members', 'username email');

        res.status(200).json(channel);
    } catch (error) {
        console.error('Error leaving channel:', error);
        res.status(500).json({ message: 'Server error leaving channel' });
    }
};

exports.updateChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { name, description } = req.body;
        const userId = req.userId;

        const channel = await Channel.findById(channelId).populate('group');
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        const group = channel.group;
        if (!group) {
            return res.status(404).json({ message: 'Group not found for this channel' });
        }

        const isOwner = group.owner.toString() === userId;
        const isAdmin = group.admins.some(admin => admin.toString() === userId);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Only admins can update channels' });
        }

        // Update fields if provided
        if (name) channel.name = name;
        if (description !== undefined) channel.description = description;

        await channel.save();
        await channel.populate('members', 'username email');

        // Only populate createdBy if it exists (for backward compatibility)
        if (channel.createdBy) {
            await channel.populate('createdBy', 'username email');
        }

        res.status(200).json(channel);
    } catch (error) {
        console.error('Error updating channel:', error);
        res.status(500).json({ message: 'Server error updating channel' });
    }
};

exports.deleteChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.userId;

        const channel = await Channel.findById(channelId).populate('group');
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        const group = channel.group;
        if (!group) {
            return res.status(404).json({ message: 'Group not found for this channel' });
        }

        const isOwner = group.owner.toString() === userId;
        const isAdmin = group.admins.some(admin => admin.toString() === userId);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Only admins can delete channels' });
        }

        await Channel.findByIdAndDelete(channelId);

        res.status(200).json({ message: 'Channel deleted successfully', channelId });
    } catch (error) {
        console.error('Error deleting channel:', error);
        res.status(500).json({ message: 'Server error deleting channel' });
    }
};

exports.addMember = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { userId } = req.body;
        const requesterId = req.userId;

        const channel = await Channel.findById(channelId).populate('group');
        if (!channel) return res.status(404).json({ message: 'Channel not found' });

        // Check Admin/Owner permission
        const group = channel.group;
        if (!group) return res.status(404).json({ message: 'Group not found' });

        const isOwner = group.owner.toString() === requesterId;
        const isAdmin = group.admins.some(admin => admin.toString() === requesterId);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Only admins can add members to channels' });
        }

        if (channel.members.includes(userId)) {
            return res.status(400).json({ message: 'User already in channel' });
        }

        channel.members.push(userId);
        await channel.save();
        await channel.populate('members', 'username email');

        // Notify the user they were added
        const io = require('../sockets/chat.socket').getIO();
        io.to(userId).emit('added_to_channel', channel);

        res.json(channel);
    } catch (error) {
        console.error('Error adding member:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.removeMember = async (req, res) => {
    try {
        const { channelId, userId } = req.params;
        const requesterId = req.userId;

        const channel = await Channel.findById(channelId).populate('group');
        if (!channel) return res.status(404).json({ message: 'Channel not found' });

        const group = channel.group;
        if (!group) return res.status(404).json({ message: 'Group not found' });

        const isOwner = group.owner.toString() === requesterId;
        const isAdmin = group.admins.some(admin => admin.toString() === requesterId);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Only admins can remove members from channels' });
        }

        channel.members = channel.members.filter(m => m.toString() !== userId);
        await channel.save();
        await channel.populate('members', 'username email');

        // Notify the user they were removed
        const io = require('../sockets/chat.socket').getIO();
        io.to(userId).emit('removed_from_channel', { channelId, groupId: group._id });

        res.json(channel);
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
