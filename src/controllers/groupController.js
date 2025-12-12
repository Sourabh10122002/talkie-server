const Group = require('../models/Group');
const Channel = require('../models/Channel');
const User = require('../models/User');
const crypto = require('crypto');

// Create a group
exports.createGroup = async (req, res) => {
    try {
        const { name, description } = req.body;

        const existingGroupInvite = crypto.randomBytes(4).toString('hex');

        const newGroup = await Group.create({
            name,
            description,
            owner: req.userId,
            inviteCode: existingGroupInvite
        });

        // Add group to user's list
        await User.findByIdAndUpdate(req.userId, {
            $push: { groups: newGroup._id }
        });

        // Create default 'general' channel
        const defaultChannel = await Channel.create({
            name: 'general',
            group: newGroup._id,
            type: 'public'
        });

        // Update group with channel
        newGroup.channels.push(defaultChannel._id);
        await newGroup.save();

        res.status(201).json(newGroup);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get user's groups
exports.getUserGroups = async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate('groups');
        res.json(user.groups);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Join group via invite code
exports.joinGroup = async (req, res) => {
    try {
        const { inviteCode } = req.body;
        const group = await Group.findOne({ inviteCode });

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        if (group.members.includes(req.userId)) {
            return res.status(400).json({ message: 'Already a member' });
        }

        group.members.push(req.userId);
        await group.save();

        await User.findByIdAndUpdate(req.userId, {
            $push: { groups: group._id }
        });

        // Automatically add user to 'general' channel of the group
        const generalChannel = await Channel.findOne({ group: group._id, name: 'general' });
        if (generalChannel) {
            if (!generalChannel.members.includes(req.userId)) {
                generalChannel.members.push(req.userId);
                await generalChannel.save();
            }
        }

        res.json(group);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Create channel in group
exports.createGroupChannel = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, type } = req.body;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Check if user is admin or owner
        const isOwner = group.owner.toString() === req.userId;
        const isAdmin = group.admins.some(admin => admin.toString() === req.userId);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Only admins can create channels' });
        }

        const newChannel = await Channel.create({
            name,
            type,
            group: groupId
        });

        group.channels.push(newChannel._id);
        await group.save();

        res.status(201).json(newChannel);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get channels for a group
exports.getGroupChannels = async (req, res) => {
    try {

        const { groupId } = req.params;
        const group = await Group.findById(groupId).populate({
            path: 'channels',
            populate: {
                path: 'members',
                select: 'username email'
            }
        });

        if (!group) return res.status(404).json({ message: 'Group not found' });

        if (!group.members.includes(req.userId)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Filter channels based on privacy and membership
        const visibleChannels = group.channels.filter(channel => {
            // Apply membership check to ALL channels (Public and Private) as requested
            // if (channel.type !== 'private') return true; 

            const isMember = channel.members.some(m => m._id.toString() === req.userId);
            const isOwner = group.owner.toString() === req.userId;
            const isAdmin = group.admins.some(a => a.toString() === req.userId);

            return isMember || isOwner || isAdmin;
        });

        res.json(visibleChannels);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Promote member to admin
exports.promoteToAdmin = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body; // ID of user to promote
        const requesterId = req.userId;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Check if requester is owner or admin
        const isOwner = group.owner.toString() === requesterId;
        const isAdmin = group.admins.some(admin => admin.toString() === requesterId);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to promote members' });
        }

        if (!group.members.includes(userId)) {
            return res.status(400).json({ message: 'User is not a member of this group' });
        }

        if (group.admins.includes(userId)) {
            return res.status(400).json({ message: 'User is already an admin' });
        }

        group.admins.push(userId);
        await group.save();

        res.json(group);
    } catch (error) {
        console.error('Error promoting member:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get members of a group
exports.getGroupMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const group = await Group.findById(groupId).populate('members', 'username email _id');

        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Security check: Requester must be a member
        if (!group.members.some(m => m._id.toString() === req.userId)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(group.members);
    } catch (error) {
        console.error('Error fetching group members:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Delete a group
exports.deleteGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const requesterId = req.userId;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Check if requester is owner or admin
        const isOwner = group.owner.toString() === requesterId;
        const isAdmin = group.admins.some(admin => admin.toString() === requesterId);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Only admins/owners can delete the group' });
        }

        // Delete all channels associated with this group
        await Channel.deleteMany({ group: groupId });

        // Remove group reference from all users
        await User.updateMany(
            { groups: groupId },
            { $pull: { groups: groupId } }
        );

        // Delete the group
        await Group.findByIdAndDelete(groupId);

        res.json({ message: 'Group deleted successfully', groupId });
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
