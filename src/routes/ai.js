const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getMatchScore,
  getTopMatches,
  computeAIScore,
  getAIScore,
  batchComputeScores,
  predictCampaign,
  analyzeContent,
  analyzeContentBatch,
  getPricingRecommendation,
  getBudgetSuggestion,
  generateBrief,
  getBriefTemplates,
  chatWithAssistant,
  getQuickActions,
  getAssistantHistory,
  getGrowthInsights,
} = require('../controllers/aiController');

// All AI routes require authentication
router.use(protect);

// ─── Matching (Task 50) ───
router.post('/matching/score', authorize('brand', 'influencer'), getMatchScore);
router.post('/matching/top', authorize('brand'), getTopMatches);

// ─── Scoring (Task 51) ───
router.post('/scoring/compute', computeAIScore);
router.get('/scoring/:userId', getAIScore);
router.post('/scoring/batch', authorize('admin'), batchComputeScores);

// ─── Prediction (Task 52) ───
router.post('/prediction/campaign', authorize('brand'), predictCampaign);

// ─── Content Analysis (Task 53) ───
router.post('/content/analyze', analyzeContent);
router.post('/content/analyze-batch', analyzeContentBatch);

// ─── Pricing (Task 54) ───
router.post('/pricing/recommend', authorize('influencer', 'brand'), getPricingRecommendation);
router.post('/pricing/budget', authorize('brand'), getBudgetSuggestion);

// ─── Brief Generator (Task 55) ───
router.post('/brief/generate', authorize('brand'), generateBrief);
router.get('/brief/templates', authorize('brand'), getBriefTemplates);

// ─── Chat Assistant (Tasks 56-57) ───
router.post('/assistant/chat', chatWithAssistant);
router.get('/assistant/actions', getQuickActions);
router.get('/assistant/history', getAssistantHistory);

// ─── Growth Insights (Task 58) ───
router.get('/insights', authorize('influencer'), getGrowthInsights);

module.exports = router;
