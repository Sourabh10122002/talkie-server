const express = require('express');
const router = express.Router();
const { getChannels, createChannel, joinChannel, leaveChannel, updateChannel, deleteChannel } = require('../controllers/channelController');
const channelController = require('../controllers/channelController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, channelController.getChannels);
router.post('/', auth, channelController.createChannel);
router.put('/:channelId', auth, channelController.updateChannel);
router.delete('/:channelId', auth, channelController.deleteChannel);
// Join/Leave channel (User self-action)
router.post('/:channelId/join', auth, channelController.joinChannel);
router.post('/:channelId/leave', auth, channelController.leaveChannel);

// Add/Remove members (Admin action)
router.post('/:channelId/members', auth, channelController.addMember);
router.delete('/:channelId/members/:userId', auth, channelController.removeMember);

module.exports = router;
