const CampaignMetrics = require('../models/CampaignMetrics');
const Campaign = require('../models/Campaign');
const Payment = require('../models/Payment');
const Application = require('../models/Application');
const DeliverableSubmission = require('../models/DeliverableSubmission');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// ═══════════════════════════════════════
// CAMPAIGN ANALYTICS (Task 43)
// ═══════════════════════════════════════

// @desc    Track/update campaign metrics
// @route   POST /api/v1/analytics/campaigns/:campaignId/track
exports.trackCampaignMetrics = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const {
      impressions, reach, engagement, clicks, conversions,
      shares, saves, comments, likes, views,
      revenue, platformMetrics, audienceDemographics,
    } = req.body;

    const campaign = await Campaign.findOne({
      _id: campaignId,
      $or: [{ brand: req.user._id }],
    });
    if (!campaign) {
      return next(new AppError('Campaign not found or not authorized', 404));
    }

    let metrics = await CampaignMetrics.findOne({ campaign: campaignId, influencer: req.body.influencerId || null });

    if (!metrics) {
      metrics = new CampaignMetrics({
        campaign: campaignId,
        influencer: req.body.influencerId || null,
        periodStart: campaign.timeline?.startDate || new Date(),
        periodEnd: campaign.timeline?.endDate || new Date(),
      });
    }

    // Increment metrics
    if (impressions) metrics.impressions += impressions;
    if (reach) metrics.reach += reach;
    if (engagement) metrics.engagement += engagement;
    if (clicks) metrics.clicks += clicks;
    if (conversions) metrics.conversions += conversions;
    if (shares) metrics.shares += shares;
    if (saves) metrics.saves += saves;
    if (comments) metrics.comments += comments;
    if (likes) metrics.likes += likes;
    if (views) metrics.views += views;
    if (revenue) metrics.revenue += revenue;

    // Recalculate derived metrics
    if (metrics.impressions > 0) {
      metrics.engagementRate = (metrics.engagement / metrics.impressions) * 100;
      metrics.costPerClick = metrics.spend > 0 && metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
      metrics.costPerConversion = metrics.spend > 0 && metrics.conversions > 0 ? metrics.spend / metrics.conversions : 0;
      metrics.roi = metrics.spend > 0 ? ((metrics.revenue - metrics.spend) / metrics.spend) * 100 : 0;
    }

    if (platformMetrics) metrics.platformMetrics = platformMetrics;
    if (audienceDemographics) metrics.audienceDemographics = audienceDemographics;

    // Add daily snapshot
    const today = new Date().toISOString().split('T')[0];
    const existingSnapshot = metrics.dailySnapshots.find(
      (s) => s.date && s.date.toISOString().split('T')[0] === today
    );
    if (existingSnapshot) {
      existingSnapshot.impressions += impressions || 0;
      existingSnapshot.clicks += clicks || 0;
      existingSnapshot.conversions += conversions || 0;
      existingSnapshot.engagement += engagement || 0;
    } else {
      metrics.dailySnapshots.push({
        date: new Date(),
        impressions: impressions || 0,
        clicks: clicks || 0,
        conversions: conversions || 0,
        engagement: engagement || 0,
      });
    }

    metrics.lastUpdated = new Date();
    await metrics.save();

    return success(res, { metrics }, 'Metrics updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Get campaign analytics (brand)
// @route   GET /api/v1/analytics/campaigns/:campaignId
exports.getCampaignAnalytics = async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.campaignId,
      brand: req.user._id,
    }).select('title status budget timeline platform niche');

    if (!campaign) {
      return next(new AppError('Campaign not found', 404));
    }

    const metrics = await CampaignMetrics.find({ campaign: req.params.campaignId })
      .populate('influencer', 'name avatar')
      .lean();

    // Aggregate totals across all influencers
    const totals = metrics.reduce(
      (acc, m) => ({
        impressions: acc.impressions + m.impressions,
        reach: acc.reach + m.reach,
        engagement: acc.engagement + m.engagement,
        clicks: acc.clicks + m.clicks,
        conversions: acc.conversions + m.conversions,
        shares: acc.shares + m.shares,
        saves: acc.saves + m.saves,
        comments: acc.comments + m.comments,
        likes: acc.likes + m.likes,
        views: acc.views + m.views,
        spend: acc.spend + m.spend,
        revenue: acc.revenue + m.revenue,
      }),
      { impressions: 0, reach: 0, engagement: 0, clicks: 0, conversions: 0, shares: 0, saves: 0, comments: 0, likes: 0, views: 0, spend: 0, revenue: 0 }
    );

    totals.engagementRate = totals.impressions > 0 ? (totals.engagement / totals.impressions) * 100 : 0;
    totals.roi = totals.spend > 0 ? ((totals.revenue - totals.spend) / totals.spend) * 100 : 0;
    totals.costPerClick = totals.clicks > 0 && totals.spend > 0 ? totals.spend / totals.clicks : 0;
    totals.costPerConversion = totals.conversions > 0 && totals.spend > 0 ? totals.spend / totals.conversions : 0;

    // Merge daily snapshots for chart
    const dailyMap = {};
    metrics.forEach((m) => {
      (m.dailySnapshots || []).forEach((s) => {
        const key = s.date ? s.date.toISOString().split('T')[0] : '';
        if (!key) return;
        if (!dailyMap[key]) dailyMap[key] = { date: key, impressions: 0, clicks: 0, conversions: 0, engagement: 0 };
        dailyMap[key].impressions += s.impressions;
        dailyMap[key].clicks += s.clicks;
        dailyMap[key].conversions += s.conversions;
        dailyMap[key].engagement += s.engagement;
      });
    });
    const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return success(res, {
      campaign,
      totals,
      byInfluencer: metrics,
      dailyData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get aggregate analytics for all brand campaigns
// @route   GET /api/v1/analytics/brand/overview
exports.getBrandOverview = async (req, res, next) => {
  try {
    const campaigns = await Campaign.find({ brand: req.user._id }).select('_id title status budget').lean();
    const campaignIds = campaigns.map((c) => c._id);

    const [metricsAgg, spendAgg, campaignsByStatus, topCampaigns] = await Promise.all([
      CampaignMetrics.aggregate([
        { $match: { campaign: { $in: campaignIds } } },
        {
          $group: {
            _id: null,
            totalImpressions: { $sum: '$impressions' },
            totalReach: { $sum: '$reach' },
            totalClicks: { $sum: '$clicks' },
            totalConversions: { $sum: '$conversions' },
            totalEngagement: { $sum: '$engagement' },
            totalRevenue: { $sum: '$revenue' },
            totalSpend: { $sum: '$spend' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { brand: req.user._id, status: { $in: ['escrow_held', 'released'] } } },
        { $group: { _id: null, totalSpent: { $sum: '$amount' } } },
      ]),
      Campaign.aggregate([
        { $match: { brand: req.user._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      CampaignMetrics.aggregate([
        { $match: { campaign: { $in: campaignIds } } },
        { $group: { _id: '$campaign', impressions: { $sum: '$impressions' }, clicks: { $sum: '$clicks' }, conversions: { $sum: '$conversions' }, roi: { $avg: '$roi' } } },
        { $sort: { impressions: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'campaigns', localField: '_id', foreignField: '_id', as: 'info' } },
        { $unwind: { path: '$info', preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    // Monthly spend trend
    const monthlySpend = await Payment.aggregate([
      { $match: { brand: req.user._id, status: { $in: ['escrow_held', 'released'] } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);

    return success(res, {
      metrics: metricsAgg[0] || {},
      totalSpent: spendAgg[0]?.totalSpent || 0,
      campaignsByStatus,
      topCampaigns,
      monthlySpend: monthlySpend.reverse(),
      totalCampaigns: campaigns.length,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get influencer performance analytics
// @route   GET /api/v1/analytics/influencer/overview
exports.getInfluencerOverview = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [metricsAgg, earningsAgg, campaignCount, applicationStats, monthlyEarnings] = await Promise.all([
      CampaignMetrics.aggregate([
        { $match: { influencer: userId } },
        {
          $group: {
            _id: null,
            totalImpressions: { $sum: '$impressions' },
            totalReach: { $sum: '$reach' },
            totalEngagement: { $sum: '$engagement' },
            totalClicks: { $sum: '$clicks' },
            totalViews: { $sum: '$views' },
            avgEngagementRate: { $avg: '$engagementRate' },
            campaignsTracked: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { influencer: userId, status: 'released' } },
        { $group: { _id: null, totalEarned: { $sum: '$influencerPayout' } } },
      ]),
      Application.countDocuments({ influencer: userId, status: 'accepted' }),
      Application.aggregate([
        { $match: { influencer: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { influencer: userId, status: 'released' } },
        { $group: { _id: { year: { $year: '$releasedAt' }, month: { $month: '$releasedAt' } }, total: { $sum: '$influencerPayout' }, count: { $sum: 1 } } },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
      ]),
    ]);

    // Top performing campaigns
    const topCampaigns = await CampaignMetrics.find({ influencer: userId })
      .populate('campaign', 'title status')
      .sort({ engagement: -1 })
      .limit(5)
      .lean();

    // Pending earnings
    const pendingEarnings = await Payment.aggregate([
      { $match: { influencer: userId, status: 'escrow_held' } },
      { $group: { _id: null, total: { $sum: '$influencerPayout' } } },
    ]);

    return success(res, {
      metrics: metricsAgg[0] || {},
      totalEarned: earningsAgg[0]?.totalEarned || 0,
      pendingEarnings: pendingEarnings[0]?.total || 0,
      completedCampaigns: campaignCount,
      applicationStats,
      monthlyEarnings: monthlyEarnings.reverse(),
      topCampaigns,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Compare multiple campaigns (brand)
// @route   POST /api/v1/analytics/campaigns/compare
exports.compareCampaigns = async (req, res, next) => {
  try {
    const { campaignIds } = req.body;
    if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length < 2) {
      return next(new AppError('Provide at least 2 campaignIds to compare', 400));
    }

    const campaigns = await Campaign.find({
      _id: { $in: campaignIds },
      brand: req.user._id,
    }).select('title status budget platform').lean();

    const metricsMap = {};
    for (const cId of campaignIds) {
      const agg = await CampaignMetrics.aggregate([
        { $match: { campaign: new (require('mongoose').Types.ObjectId)(cId) } },
        {
          $group: {
            _id: null,
            impressions: { $sum: '$impressions' },
            reach: { $sum: '$reach' },
            clicks: { $sum: '$clicks' },
            conversions: { $sum: '$conversions' },
            engagement: { $sum: '$engagement' },
            spend: { $sum: '$spend' },
            revenue: { $sum: '$revenue' },
          },
        },
      ]);
      metricsMap[cId] = agg[0] || { impressions: 0, reach: 0, clicks: 0, conversions: 0, engagement: 0, spend: 0, revenue: 0 };
    }

    const comparison = campaigns.map((c) => ({
      campaign: c,
      metrics: metricsMap[c._id.toString()] || {},
    }));

    return success(res, { comparison });
  } catch (error) {
    next(error);
  }
};

// @desc    Export campaign analytics as CSV
// @route   GET /api/v1/analytics/campaigns/:campaignId/export
exports.exportCampaignAnalytics = async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.campaignId, brand: req.user._id });
    if (!campaign) return next(new AppError('Campaign not found', 404));

    const metrics = await CampaignMetrics.find({ campaign: req.params.campaignId })
      .populate('influencer', 'name email')
      .lean();

    // Build CSV
    const headers = 'Influencer,Impressions,Reach,Engagement,Clicks,Conversions,Spend,Revenue,ROI\n';
    const rows = metrics.map((m) =>
      `${m.influencer?.name || 'Overall'},${m.impressions},${m.reach},${m.engagement},${m.clicks},${m.conversions},${m.spend},${m.revenue},${m.roi.toFixed(2)}%`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=campaign_${req.params.campaignId}_analytics.csv`);
    return res.send(headers + rows);
  } catch (error) {
    next(error);
  }
};
