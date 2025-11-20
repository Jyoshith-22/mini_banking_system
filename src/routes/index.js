const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./users');
const txRoutes = require('./transactions');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/transactions', txRoutes);

module.exports = router;
