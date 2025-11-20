const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/authMiddleware');
const txController = require('../controllers/txController');

router.post('/deposit', auth, body('amount').isFloat({ gt: 0.0 }), (req, res, next) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() }); next();
}, txController.deposit);

router.post('/withdraw', auth, body('amount').isFloat({ gt: 0.0 }), (req, res, next) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() }); next();
}, txController.withdraw);

router.post('/transfer', auth, body('amount').isFloat({ gt: 0.0 }), body('toUserId').isInt({ gt: 0 }), (req, res, next) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() }); next();
}, txController.transfer);

router.get('/history', auth, txController.history);

module.exports = router;
