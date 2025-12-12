const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const groupController = require('../controllers/groupController');

// Create a group
router.post('/', auth, groupController.createGroup);

// Get user's groups
router.get('/', auth, groupController.getUserGroups);

// Join group via invite code
router.post('/join', auth, groupController.joinGroup);

// Create channel in group
router.post('/:groupId/channels', auth, groupController.createGroupChannel);

// Get channels for a group
// Get channels for a group
router.get('/:groupId/channels', auth, groupController.getGroupChannels);

// Promote member to admin
router.put('/:groupId/admins', auth, groupController.promoteToAdmin);

// Get members
router.get('/:groupId/members', auth, groupController.getGroupMembers);

// Delete group
router.delete('/:groupId', auth, groupController.deleteGroup);

module.exports = router;
