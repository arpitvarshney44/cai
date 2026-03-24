const SupportTicket = require('../models/SupportTicket');
const AuditLog = require('../models/AuditLog');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// ─── USER-FACING ──────────────────────────────────────

// @desc    Create a support ticket
// @route   POST /api/v1/support/tickets
exports.createTicket = async (req, res, next) => {
  try {
    const { subject, category, priority, description, relatedCampaign, relatedPayment } = req.body;

    const ticket = await SupportTicket.create({
      user: req.user._id,
      subject,
      category,
      priority: priority || 'medium',
      description,
      relatedCampaign: relatedCampaign || undefined,
      relatedPayment: relatedPayment || undefined,
    });

    return success(res, { ticket }, 'Ticket created successfully', 201);
  } catch (err) {
    next(err);
  }
};

// @desc    Get my tickets
// @route   GET /api/v1/support/tickets/mine
exports.getMyTickets = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-responses'),
      SupportTicket.countDocuments(filter),
    ]);

    return success(res, {
      tickets,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get ticket detail (user)
// @route   GET /api/v1/support/tickets/:id
exports.getTicketById = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('user', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('responses.sender', 'name email role');

    if (!ticket) return next(new AppError('Ticket not found', 404));

    // Users can only see their own tickets
    if (req.user.role !== 'admin' && ticket.user._id.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized', 403));
    }

    return success(res, { ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Add response to ticket (user or admin)
// @route   POST /api/v1/support/tickets/:id/respond
exports.respondToTicket = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return next(new AppError('Message is required', 400));

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return next(new AppError('Ticket not found', 404));

    // Users can only respond to their own tickets
    if (req.user.role !== 'admin' && ticket.user.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized', 403));
    }

    const senderRole = req.user.role === 'admin' ? 'admin' : 'user';

    ticket.responses.push({
      sender: req.user._id,
      senderRole,
      message,
    });

    // Update status based on who responded
    if (senderRole === 'admin') {
      ticket.status = 'waiting_on_user';
    } else {
      ticket.status = 'waiting_on_admin';
    }

    await ticket.save();
    return success(res, { ticket }, 'Response added');
  } catch (err) {
    next(err);
  }
};

// ─── ADMIN-FACING ─────────────────────────────────────

// @desc    Get all tickets (admin)
// @route   GET /api/v1/admin/support/tickets
exports.getAllTickets = async (req, res, next) => {
  try {
    const {
      status, category, priority, assignedTo, search,
      page = 1, limit = 20, sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { ticketNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate('user', 'name email role')
        .populate('assignedTo', 'name email')
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-responses'),
      SupportTicket.countDocuments(filter),
    ]);

    return success(res, {
      tickets,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Assign ticket to admin
// @route   PUT /api/v1/admin/support/tickets/:id/assign
exports.assignTicket = async (req, res, next) => {
  try {
    const { adminId } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return next(new AppError('Ticket not found', 404));

    ticket.assignedTo = adminId || req.user._id;
    ticket.status = 'in_progress';
    await ticket.save();

    await AuditLog.create({
      admin: req.user._id,
      action: 'ticket_assigned',
      targetType: 'ticket',
      targetId: ticket._id,
      description: `Ticket ${ticket.ticketNumber} assigned to admin`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return success(res, { ticket }, 'Ticket assigned');
  } catch (err) {
    next(err);
  }
};

// @desc    Resolve ticket
// @route   PUT /api/v1/admin/support/tickets/:id/resolve
exports.resolveTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return next(new AppError('Ticket not found', 404));

    ticket.status = 'resolved';
    ticket.resolvedAt = new Date();
    ticket.resolvedBy = req.user._id;
    await ticket.save();

    await AuditLog.create({
      admin: req.user._id,
      action: 'ticket_resolved',
      targetType: 'ticket',
      targetId: ticket._id,
      description: `Ticket ${ticket.ticketNumber} resolved`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return success(res, { ticket }, 'Ticket resolved');
  } catch (err) {
    next(err);
  }
};

// @desc    Close ticket
// @route   PUT /api/v1/admin/support/tickets/:id/close
exports.closeTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return next(new AppError('Ticket not found', 404));

    ticket.status = 'closed';
    ticket.closedAt = new Date();
    await ticket.save();

    await AuditLog.create({
      admin: req.user._id,
      action: 'ticket_closed',
      targetType: 'ticket',
      targetId: ticket._id,
      description: `Ticket ${ticket.ticketNumber} closed`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return success(res, { ticket }, 'Ticket closed');
  } catch (err) {
    next(err);
  }
};

// @desc    Get support ticket stats
// @route   GET /api/v1/admin/support/stats
exports.getTicketStats = async (req, res, next) => {
  try {
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
    ] = await Promise.all([
      SupportTicket.countDocuments(),
      SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ status: 'in_progress' }),
      SupportTicket.countDocuments({ status: 'resolved' }),
      SupportTicket.countDocuments({ status: 'closed' }),
      SupportTicket.countDocuments({ priority: 'urgent', status: { $in: ['open', 'in_progress'] } }),
    ]);

    const byCategory = await SupportTicket.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const byPriority = await SupportTicket.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Average resolution time
    const avgResolution = await SupportTicket.aggregate([
      { $match: { resolvedAt: { $ne: null } } },
      { $project: { resTime: { $subtract: ['$resolvedAt', '$createdAt'] } } },
      { $group: { _id: null, avg: { $avg: '$resTime' } } },
    ]);
    const avgResolutionHours = avgResolution.length > 0
      ? Math.round(avgResolution[0].avg / (1000 * 60 * 60) * 10) / 10
      : 0;

    // Satisfaction rating
    const ratingStats = await SupportTicket.aggregate([
      { $match: { rating: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    return success(res, {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      byCategory,
      byPriority,
      avgResolutionHours,
      satisfactionRating: ratingStats.length > 0 ? Math.round(ratingStats[0].avg * 10) / 10 : 0,
      totalRatings: ratingStats.length > 0 ? ratingStats[0].count : 0,
    });
  } catch (err) {
    next(err);
  }
};
