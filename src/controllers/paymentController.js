const Payment = require('../models/Payment');
const Campaign = require('../models/Campaign');
const Contract = require('../models/Contract');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// ─── PLAN CONFIG ───
const PLATFORM_FEE_PERCENT = 10;

// @desc    Create escrow payment (brand funds a campaign for an influencer)
// @route   POST /api/v1/payments/escrow
exports.createEscrowPayment = async (req, res, next) => {
  try {
    const { campaignId, influencerId, amount, currency, contractId, description } = req.body;

    if (!campaignId || !influencerId || !amount) {
      return next(new AppError('campaignId, influencerId, and amount are required', 400));
    }

    // Verify campaign belongs to brand
    const campaign = await Campaign.findOne({ _id: campaignId, brand: req.user._id });
    if (!campaign) {
      return next(new AppError('Campaign not found or not authorized', 404));
    }

    // Calculate fees
    const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;
    const influencerPayout = Math.round((amount - platformFee) * 100) / 100;

    // In production: create Razorpay order here
    // const razorpay = new Razorpay({ key_id, key_secret });
    // const order = await razorpay.orders.create({ amount: amount * 100, currency, ... });
    const mockOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const payment = await Payment.create({
      campaign: campaignId,
      brand: req.user._id,
      influencer: influencerId,
      contract: contractId || null,
      amount,
      currency: currency || 'INR',
      platformFee,
      platformFeePercent: PLATFORM_FEE_PERCENT,
      influencerPayout,
      razorpayOrderId: mockOrderId,
      status: 'pending',
      type: 'escrow',
      description: description || `Escrow payment for ${campaign.title}`,
    });

    const populated = await Payment.findById(payment._id)
      .populate('campaign', 'title')
      .populate('brand', 'name email')
      .populate('influencer', 'name email');

    return success(res, {
      payment: populated,
      razorpayOrderId: mockOrderId,
      amount: amount * 100, // Razorpay expects paise
      currency: currency || 'INR',
    }, 'Escrow payment order created', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Verify payment (after Razorpay callback)
// @route   POST /api/v1/payments/verify
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return next(new AppError('razorpayOrderId and razorpayPaymentId are required', 400));
    }

    const payment = await Payment.findOne({ razorpayOrderId, brand: req.user._id });
    if (!payment) {
      return next(new AppError('Payment not found', 404));
    }

    if (payment.status !== 'pending') {
      return next(new AppError('Payment already processed', 400));
    }

    // In production: verify signature with Razorpay
    // const expectedSignature = crypto.createHmac('sha256', key_secret)
    //   .update(razorpayOrderId + '|' + razorpayPaymentId).digest('hex');
    // if (expectedSignature !== razorpaySignature) return next(new AppError('Invalid signature', 400));

    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature || 'mock_signature';
    payment.status = 'escrow_held';
    await payment.save();

    // Notify influencer
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${payment.influencer}`).emit('paymentReceived', {
        paymentId: payment._id,
        amount: payment.amount,
        status: 'escrow_held',
      });
    }

    const populated = await Payment.findById(payment._id)
      .populate('campaign', 'title')
      .populate('brand', 'name email')
      .populate('influencer', 'name email');

    return success(res, { payment: populated }, 'Payment verified and held in escrow');
  } catch (error) {
    next(error);
  }
};

// @desc    Release escrow payment to influencer
// @route   PUT /api/v1/payments/:paymentId/release
exports.releasePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      brand: req.user._id,
      status: 'escrow_held',
    });

    if (!payment) {
      return next(new AppError('Payment not found or not in escrow', 404));
    }

    // In production: initiate payout via Razorpay Payouts API
    const mockPayoutId = `payout_${Date.now()}`;

    payment.status = 'released';
    payment.releasedAt = new Date();
    payment.releasedBy = req.user._id;
    payment.releaseNote = req.body.note || '';
    payment.payoutStatus = 'processing';
    payment.payoutId = mockPayoutId;
    await payment.save();

    // Notify influencer
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${payment.influencer}`).emit('paymentReleased', {
        paymentId: payment._id,
        amount: payment.influencerPayout,
      });
    }

    const populated = await Payment.findById(payment._id)
      .populate('campaign', 'title')
      .populate('brand', 'name email')
      .populate('influencer', 'name email');

    return success(res, { payment: populated }, 'Payment released to influencer');
  } catch (error) {
    next(error);
  }
};

// @desc    Refund payment to brand
// @route   PUT /api/v1/payments/:paymentId/refund
exports.refundPayment = async (req, res, next) => {
  try {
    const { reason, amount: refundAmount } = req.body;

    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      brand: req.user._id,
      status: { $in: ['escrow_held', 'released'] },
    });

    if (!payment) {
      return next(new AppError('Payment not found or cannot be refunded', 404));
    }

    const actualRefund = refundAmount || payment.amount;
    if (actualRefund > payment.amount) {
      return next(new AppError('Refund amount exceeds payment amount', 400));
    }

    // In production: initiate refund via Razorpay
    const mockRefundId = `rfnd_${Date.now()}`;

    payment.status = actualRefund < payment.amount ? 'partially_refunded' : 'refunded';
    payment.refundedAt = new Date();
    payment.refundAmount = actualRefund;
    payment.refundReason = reason || '';
    payment.refundId = mockRefundId;
    payment.payoutStatus = 'failed';
    await payment.save();

    const populated = await Payment.findById(payment._id)
      .populate('campaign', 'title')
      .populate('brand', 'name email')
      .populate('influencer', 'name email');

    return success(res, { payment: populated }, 'Payment refunded');
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment history for current user
// @route   GET /api/v1/payments
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      $or: [{ brand: req.user._id }, { influencer: req.user._id }],
    };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('campaign', 'title')
        .populate('brand', 'name email avatar')
        .populate('influencer', 'name email avatar')
        .populate('contract', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payment.countDocuments(filter),
    ]);

    return success(res, {
      payments,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single payment detail
// @route   GET /api/v1/payments/:paymentId
exports.getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      $or: [{ brand: req.user._id }, { influencer: req.user._id }],
    })
      .populate('campaign', 'title description')
      .populate('brand', 'name email avatar')
      .populate('influencer', 'name email avatar')
      .populate('contract', 'title status');

    if (!payment) {
      return next(new AppError('Payment not found', 404));
    }

    return success(res, { payment });
  } catch (error) {
    next(error);
  }
};

// @desc    Get earnings summary for influencer
// @route   GET /api/v1/payments/earnings
exports.getEarnings = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [totalEarnings, pendingEarnings, releasedPayments, allPayments] = await Promise.all([
      Payment.aggregate([
        { $match: { influencer: userId, status: 'released' } },
        { $group: { _id: null, total: { $sum: '$influencerPayout' } } },
      ]),
      Payment.aggregate([
        { $match: { influencer: userId, status: 'escrow_held' } },
        { $group: { _id: null, total: { $sum: '$influencerPayout' } } },
      ]),
      Payment.countDocuments({ influencer: userId, status: 'released' }),
      Payment.countDocuments({ influencer: userId }),
    ]);

    // Monthly earnings for chart
    const monthlyEarnings = await Payment.aggregate([
      { $match: { influencer: userId, status: 'released' } },
      {
        $group: {
          _id: { year: { $year: '$releasedAt' }, month: { $month: '$releasedAt' } },
          total: { $sum: '$influencerPayout' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);

    return success(res, {
      totalEarnings: totalEarnings[0]?.total || 0,
      pendingEarnings: pendingEarnings[0]?.total || 0,
      releasedPayments,
      totalPayments: allPayments,
      monthlyEarnings: monthlyEarnings.reverse(),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Razorpay webhook handler
// @route   POST /api/v1/payments/webhook
exports.razorpayWebhook = async (req, res, next) => {
  try {
    // In production: verify webhook signature
    // const signature = req.headers['x-razorpay-signature'];
    // const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(req.body)).digest('hex');

    const { event, payload } = req.body;

    if (event === 'payment.captured') {
      const orderId = payload?.payment?.entity?.order_id;
      if (orderId) {
        const payment = await Payment.findOne({ razorpayOrderId: orderId });
        if (payment && payment.status === 'pending') {
          payment.razorpayPaymentId = payload.payment.entity.id;
          payment.status = 'escrow_held';
          await payment.save();
        }
      }
    } else if (event === 'payment.failed') {
      const orderId = payload?.payment?.entity?.order_id;
      if (orderId) {
        const payment = await Payment.findOne({ razorpayOrderId: orderId });
        if (payment) {
          payment.status = 'failed';
          await payment.save();
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};
