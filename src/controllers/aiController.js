/**
 * AI Controller — Proxy layer between the app and the Python AI Engine.
 * Handles all AI feature requests (Tasks 49-58).
 */

const config = require('../config');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

/**
 * Internal helper to call the AI engine
 */
async function callAI(path, method = 'GET', body = null) {
  const url = `${AI_ENGINE_URL}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new AppError(data.detail || data.message || 'AI Engine error', response.status);
  }
  return data;
}

// ═══════════════════════════════════════
// MATCHING (Task 50)
// ═══════════════════════════════════════

// @desc    Get match score between campaign and influencer
// @route   POST /api/v1/ai/matching/score
exports.getMatchScore = async (req, res, next) => {
  try {
    const { campaignId, influencerProfileId } = req.body;
    if (!campaignId || !influencerProfileId) {
      return next(new AppError('campaignId and influencerProfileId are required', 400));
    }
    const result = await callAI('/api/ai/matching/score', 'POST', { campaignId, influencerProfileId });
    success(res, result.data, 'Match score computed');
  } catch (err) {
    next(err);
  }
};

// @desc    Get top matching influencers for a campaign
// @route   POST /api/v1/ai/matching/top
exports.getTopMatches = async (req, res, next) => {
  try {
    const { campaignId, limit } = req.body;
    if (!campaignId) {
      return next(new AppError('campaignId is required', 400));
    }
    const result = await callAI('/api/ai/matching/top-matches', 'POST', { campaignId, limit: limit || 20 });
    success(res, result.data, 'Top matches found');
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════
// SCORING (Task 51)
// ═══════════════════════════════════════

// @desc    Compute AI score for an influencer
// @route   POST /api/v1/ai/scoring/compute
exports.computeAIScore = async (req, res, next) => {
  try {
    const { profileId } = req.body;
    const userId = req.user._id.toString();
    const result = await callAI('/api/ai/scoring/compute', 'POST', {
      profileId: profileId || undefined,
      userId: profileId ? undefined : userId,
    });
    success(res, result.data, 'AI score computed');
  } catch (err) {
    next(err);
  }
};

// @desc    Get AI score for a profile
// @route   GET /api/v1/ai/scoring/:userId
exports.getAIScore = async (req, res, next) => {
  try {
    const result = await callAI(`/api/ai/scoring/profile/${req.params.userId}`);
    success(res, result.data, 'AI score retrieved');
  } catch (err) {
    next(err);
  }
};

// @desc    Batch compute AI scores (admin)
// @route   POST /api/v1/ai/scoring/batch
exports.batchComputeScores = async (req, res, next) => {
  try {
    const { profileIds } = req.body;
    const result = await callAI('/api/ai/scoring/batch', 'POST', { profileIds: profileIds || null });
    success(res, result.data, 'Batch scores computed');
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════
// PREDICTION (Task 52)
// ═══════════════════════════════════════

// @desc    Predict campaign performance
// @route   POST /api/v1/ai/prediction/campaign
exports.predictCampaign = async (req, res, next) => {
  try {
    const { campaignId, campaignData, selectedInfluencers } = req.body;
    if (!campaignId && !campaignData) {
      return next(new AppError('campaignId or campaignData is required', 400));
    }
    const result = await callAI('/api/ai/prediction/campaign', 'POST', {
      campaignId, campaignData, selectedInfluencers,
    });
    success(res, result.data, 'Campaign prediction generated');
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════
// CONTENT ANALYSIS (Task 53)
// ═══════════════════════════════════════

// @desc    Analyze content
// @route   POST /api/v1/ai/content/analyze
exports.analyzeContent = async (req, res, next) => {
  try {
    const { text, contentType } = req.body;
    if (!text) {
      return next(new AppError('text is required', 400));
    }
    const result = await callAI('/api/ai/content/analyze', 'POST', { text, contentType: contentType || 'caption' });
    success(res, result.data, 'Content analyzed');
  } catch (err) {
    next(err);
  }
};

// @desc    Batch analyze content
// @route   POST /api/v1/ai/content/analyze-batch
exports.analyzeContentBatch = async (req, res, next) => {
  try {
    const { contents } = req.body;
    if (!contents || !contents.length) {
      return next(new AppError('contents array is required', 400));
    }
    const result = await callAI('/api/ai/content/analyze-batch', 'POST', { contents });
    success(res, result.data, 'Batch content analyzed');
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════
// PRICING (Task 54)
// ═══════════════════════════════════════

// @desc    Get pricing recommendation
// @route   POST /api/v1/ai/pricing/recommend
exports.getPricingRecommendation = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const result = await callAI('/api/ai/pricing/recommend', 'POST', { userId });
    success(res, result.data, 'Pricing recommendation generated');
  } catch (err) {
    next(err);
  }
};

// @desc    Get campaign budget suggestion
// @route   POST /api/v1/ai/pricing/budget
exports.getBudgetSuggestion = async (req, res, next) => {
  try {
    const { campaignId, campaignData } = req.body;
    const result = await callAI('/api/ai/pricing/budget-suggestion', 'POST', { campaignId, campaignData });
    success(res, result.data, 'Budget suggestion generated');
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════
// BRIEF GENERATOR (Task 55)
// ═══════════════════════════════════════

// @desc    Generate campaign brief
// @route   POST /api/v1/ai/brief/generate
exports.generateBrief = async (req, res, next) => {
  try {
    const result = await callAI('/api/ai/brief/generate', 'POST', req.body);
    success(res, result.data, 'Campaign brief generated');
  } catch (err) {
    next(err);
  }
};

// @desc    Get brief templates
// @route   GET /api/v1/ai/brief/templates
exports.getBriefTemplates = async (req, res, next) => {
  try {
    const result = await callAI('/api/ai/brief/templates');
    success(res, result.data, 'Templates retrieved');
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════
// CHAT ASSISTANT (Tasks 56-57)
// ═══════════════════════════════════════

// @desc    Send message to AI assistant
// @route   POST /api/v1/ai/assistant/chat
exports.chatWithAssistant = async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;
    if (!message) {
      return next(new AppError('message is required', 400));
    }
    const result = await callAI('/api/ai/assistant/chat', 'POST', {
      userId: req.user._id.toString(),
      role: req.user.role,
      message,
      conversationId,
    });
    success(res, result.data, 'Response generated');
  } catch (err) {
    next(err);
  }
};

// @desc    Get quick actions
// @route   GET /api/v1/ai/assistant/actions
exports.getQuickActions = async (req, res, next) => {
  try {
    const result = await callAI(`/api/ai/assistant/actions/${req.user.role}`);
    success(res, result.data, 'Quick actions retrieved');
  } catch (err) {
    next(err);
  }
};

// @desc    Get conversation history
// @route   GET /api/v1/ai/assistant/history
exports.getAssistantHistory = async (req, res, next) => {
  try {
    const { conversationId } = req.query;
    let url = `/api/ai/assistant/history/${req.user._id.toString()}`;
    if (conversationId) url += `?conversation_id=${conversationId}`;
    const result = await callAI(url);
    success(res, result.data, 'History retrieved');
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════
// GROWTH INSIGHTS (Task 58)
// ═══════════════════════════════════════

// @desc    Get growth insights for influencer
// @route   GET /api/v1/ai/insights
exports.getGrowthInsights = async (req, res, next) => {
  try {
    const result = await callAI(`/api/ai/insights/${req.user._id.toString()}`);
    success(res, result.data, 'Growth insights generated');
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════
// ADMIN AI STATS (Task 64)
// ═══════════════════════════════════════

// @desc    Get AI management stats for admin panel
// @route   GET /api/v1/admin/ai/stats
exports.getAdminAIStats = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Fetch AI scores from the ai_scores collection (written by the Python AI engine)
    const scoresCollection = db.collection('ai_scores');
    const allScores = await scoresCollection
      .find({})
      .sort({ computed_at: -1 })
      .limit(500)
      .toArray();

    const totalScored = allScores.length;
    const avgScore = totalScored > 0
      ? Math.round(allScores.reduce((sum, s) => sum + (s.overall_score || 0), 0) / totalScored)
      : 0;

    // Score distribution buckets
    const ranges = [
      { range: '0-20', min: 0, max: 20 },
      { range: '21-40', min: 21, max: 40 },
      { range: '41-60', min: 41, max: 60 },
      { range: '61-80', min: 61, max: 80 },
      { range: '81-100', min: 81, max: 100 },
    ];
    const scoreDistribution = ranges.map(({ range, min, max }) => ({
      range,
      count: allScores.filter(s => (s.overall_score || 0) >= min && (s.overall_score || 0) <= max).length,
    }));

    // Recent scores with user info
    const recentRaw = allScores.slice(0, 10);
    const userIds = recentRaw
      .map(s => s.user_id)
      .filter(Boolean)
      .map(id => {
        try { return new mongoose.Types.ObjectId(id); } catch { return null; }
      })
      .filter(Boolean);

    const users = userIds.length > 0
      ? await db.collection('users').find({ _id: { $in: userIds } }).toArray()
      : [];
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u.name || u.email || 'Unknown'; });

    const recentScores = recentRaw.map(s => ({
      profileId: s.user_id || s.profile_id || 'N/A',
      name: userMap[s.user_id] || 'Unknown',
      score: s.overall_score || 0,
      grade: s.grade || 'N/A',
    }));

    success(res, { totalScored, avgScore, scoreDistribution, recentScores }, 'AI stats retrieved');
  } catch (err) {
    next(err);
  }
};
