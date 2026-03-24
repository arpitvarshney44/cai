const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/auth');
const messageCtrl = require('../controllers/messageController');

// Multer config for message attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `msg-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4', 'video/quicktime',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// All routes require authentication
router.use(protect);

// Conversations
router.post('/conversations', messageCtrl.createConversation);
router.get('/conversations', messageCtrl.getConversations);
router.get('/conversations/:conversationId', messageCtrl.getConversation);

// Messages within a conversation
router.post('/conversations/:conversationId/messages', messageCtrl.sendMessage);
router.get('/conversations/:conversationId/messages', messageCtrl.getMessages);
router.put('/conversations/:conversationId/read', messageCtrl.markAsRead);

// Individual message operations
router.delete('/:messageId', messageCtrl.deleteMessage);

// Unread count
router.get('/unread-count', messageCtrl.getUnreadCount);

// File upload
router.post('/upload', upload.single('file'), messageCtrl.uploadAttachment);

module.exports = router;
