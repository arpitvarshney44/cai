const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/brandProfileController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

router.use(protect, authorize('brand'));

router.get('/profile/me', ctrl.getMyProfile);
router.put('/profile', ctrl.upsertProfile);
router.post('/profile/upload-logo', upload.single('logo'), ctrl.uploadLogo);

module.exports = router;
