const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/tickets', supportController.createTicket);
router.get('/tickets/mine', supportController.getMyTickets);
router.get('/tickets/:id', supportController.getTicketById);
router.post('/tickets/:id/respond', supportController.respondToTicket);

module.exports = router;
