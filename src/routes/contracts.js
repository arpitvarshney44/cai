const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const contractCtrl = require('../controllers/contractController');

// All routes require authentication
router.use(protect);

// CRUD
router.post('/', contractCtrl.createContract);
router.get('/', contractCtrl.getMyContracts);
router.get('/:contractId', contractCtrl.getContract);
router.put('/:contractId', contractCtrl.updateContract);

// Signing
router.put('/:contractId/sign', contractCtrl.signContract);

// Cancel
router.put('/:contractId/cancel', contractCtrl.cancelContract);

// By campaign
router.get('/campaign/:campaignId', contractCtrl.getContractsByCampaign);

module.exports = router;
