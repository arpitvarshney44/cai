const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Create or get existing conversation with another user
// @route   POST /api/v1/messages/conversations
exports.createConversation = async (req, res, next) => {
  try {
    const { recipientId, campaignId } = req.body;

    if (!recipientId) {
      return next(new AppError('recipientId is required', 400));
    }

    if (recipientId === req.user._id.toString()) {
      return next(new AppError('Cannot create conversation with yourself', 400));
    }

    // Verify recipient exists
    const recipient = await User.findById(recipientId).select('name email avatar role');
    if (!recipient) {
      return next(new AppError('Recipient not found', 404));
    }

    // Find or create the conversation
    const conversation = await Conversation.findOrCreateDM(
      req.user._id,
      recipientId,
      campaignId || null
    );

    // Populate participants for response
    const populated = await Conversation.findById(conversation._id)
      .populate('participants', 'name email avatar role')
      .populate('campaign', 'title');

    return success(res, { conversation: populated }, 'Conversation ready', 200);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all conversations for current user
// @route   GET /api/v1/messages/conversations
exports.getConversations = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true,
    })
      .populate('participants', 'name email avatar role')
      .populate('campaign', 'title')
      .populate('lastMessage.sender', 'name')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Attach unread count for current user to each conversation
    const userId = req.user._id.toString();
    const enriched = conversations.map((conv) => ({
      ...conv,
      unreadCount: conv.unreadCounts?.[userId] || 0,
      otherParticipant: conv.participants.find(
        (p) => p._id.toString() !== userId
      ),
    }));

    const total = await Conversation.countDocuments({
      participants: req.user._id,
      isActive: true,
    });

    return success(res, {
      conversations: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single conversation details
// @route   GET /api/v1/messages/conversations/:conversationId
exports.getConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.user._id,
    })
      .populate('participants', 'name email avatar role')
      .populate('campaign', 'title');

    if (!conversation) {
      return next(new AppError('Conversation not found', 404));
    }

    return success(res, { conversation });
  } catch (error) {
    next(error);
  }
};

// @desc    Send a message in a conversation
// @route   POST /api/v1/messages/conversations/:conversationId/messages
exports.sendMessage = async (req, res, next) => {
  try {
    const { text, attachments, messageType } = req.body;
    const conversationId = req.params.conversationId;

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return next(new AppError('Conversation not found', 404));
    }

    if (!text && (!attachments || attachments.length === 0)) {
      return next(new AppError('Message text or attachment is required', 400));
    }

    // Create the message
    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      text: text || '',
      attachments: attachments || [],
      messageType: messageType || (attachments?.length > 0 ? 'image' : 'text'),
      readBy: [{ user: req.user._id, readAt: new Date() }],
    });

    // Update conversation's lastMessage and updatedAt
    conversation.lastMessage = {
      text: text || (attachments?.length > 0 ? '📎 Attachment' : ''),
      sender: req.user._id,
      createdAt: new Date(),
    };

    // Increment unread count for all other participants
    const userId = req.user._id.toString();
    conversation.participants.forEach((participantId) => {
      const pid = participantId.toString();
      if (pid !== userId) {
        const current = conversation.unreadCounts.get(pid) || 0;
        conversation.unreadCounts.set(pid, current + 1);
      }
    });

    await conversation.save();

    // Populate sender info for response
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email avatar role');

    // Emit updates
    const io = req.app.get('io');
    const notificationUtil = require('../utils/notificationUtil');

    if (io) {
      io.to(`conversation:${conversationId}`).emit('newMessage', {
        message: populatedMessage,
        conversationId,
      });
    }

    conversation.participants.forEach((participantId) => {
      const pid = participantId.toString();
      if (pid !== userId) {
        if (io) {
          io.to(`user:${pid}`).emit('conversationUpdated', {
            conversationId,
            lastMessage: conversation.lastMessage,
            unreadCount: conversation.unreadCounts.get(pid) || 0,
          });
        }
        
        notificationUtil.createNotification(pid, {
          type: 'message',
          title: `New message from ${populatedMessage.sender.name}`,
          body: text || 'Sent an attachment',
          data: {
            screen: 'Chat',
            referenceId: conversationId,
            referenceType: 'conversation',
            extra: { 
              senderName: populatedMessage.sender.name,
              senderId: userId
            }
          }
        });
      }
    });

    return success(res, { message: populatedMessage }, 'Message sent', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get messages for a conversation (paginated, newest first)
// @route   GET /api/v1/messages/conversations/:conversationId/messages
exports.getMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, before } = req.query;
    const conversationId = req.params.conversationId;

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return next(new AppError('Conversation not found', 404));
    }

    const filter = {
      conversation: conversationId,
      isDeleted: false,
    };

    // For infinite scroll: fetch messages before a certain timestamp
    if (before) {
      filter.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(filter)
      .populate('sender', 'name email avatar role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    const total = await Message.countDocuments({
      conversation: conversationId,
      isDeleted: false,
    });

    return success(res, {
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: messages.length === parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark messages as read in a conversation
// @route   PUT /api/v1/messages/conversations/:conversationId/read
exports.markAsRead = async (req, res, next) => {
  try {
    const conversationId = req.params.conversationId;
    const userId = req.user._id;

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return next(new AppError('Conversation not found', 404));
    }

    // Mark all unread messages in this conversation as read by this user
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId },
      },
      {
        $push: {
          readBy: { user: userId, readAt: new Date() },
        },
      }
    );

    // Reset unread count for this user
    conversation.unreadCounts.set(userId.toString(), 0);
    await conversation.save();

    // Emit read receipt via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('messagesRead', {
        conversationId,
        readBy: userId,
        readAt: new Date(),
      });
    }

    return success(res, null, 'Messages marked as read');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a message (soft delete)
// @route   DELETE /api/v1/messages/:messageId
exports.deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findOne({
      _id: req.params.messageId,
      sender: req.user._id,
    });

    if (!message) {
      return next(new AppError('Message not found or not authorized', 404));
    }

    message.isDeleted = true;
    message.text = 'This message was deleted';
    message.attachments = [];
    await message.save();

    // Emit deletion via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('messageDeleted', {
        messageId: message._id,
        conversationId: message.conversation,
      });
    }

    return success(res, null, 'Message deleted');
  } catch (error) {
    next(error);
  }
};

// @desc    Get total unread message count for current user
// @route   GET /api/v1/messages/unread-count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();

    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true,
    }).lean();

    let totalUnread = 0;
    conversations.forEach((conv) => {
      totalUnread += conv.unreadCounts?.[userId] || 0;
    });

    return success(res, { totalUnread });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload attachment for a message
// @route   POST /api/v1/messages/upload
exports.uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';

    return success(res, {
      attachment: {
        type: fileType,
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      },
    }, 'File uploaded');
  } catch (error) {
    next(error);
  }
};
