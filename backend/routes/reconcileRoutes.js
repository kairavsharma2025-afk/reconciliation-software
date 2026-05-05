const express = require('express');
const { reconcile } = require('../controllers/reconcileController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.post('/', asyncHandler(reconcile));

module.exports = router;
