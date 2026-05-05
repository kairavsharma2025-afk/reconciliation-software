const express = require('express');
const {
  listTransactions, linkTransactions, unlinkTransactions,
} = require('../controllers/transactionController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/', asyncHandler(listTransactions));
router.post('/link', asyncHandler(linkTransactions));
router.post('/unlink', asyncHandler(unlinkTransactions));

module.exports = router;
