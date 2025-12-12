const express = require('express');
const router = express.Router();
const { getMessages, createMessage, deleteMessage, editMessage, searchMessages, updateMessageStatus, markMessagesAsRead } = require('../controllers/messageController');
const auth = require('../middleware/authMiddleware');

router.get('/search', auth, searchMessages);
router.get('/:channelId', auth, getMessages);
router.post('/', auth, createMessage);
router.post('/bulk-read', auth, markMessagesAsRead);
router.post('/:messageId/status', auth, updateMessageStatus);
router.put('/:messageId', auth, editMessage);
router.delete('/:messageId', auth, deleteMessage);

module.exports = router;
