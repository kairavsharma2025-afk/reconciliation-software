const express = require('express');
const { getStats } = require('../controllers/dashboardController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/stats', asyncHandler(getStats));

module.exports = router;
