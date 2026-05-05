const express = require('express');
const { listAudit } = require('../controllers/auditController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/', asyncHandler(listAudit));

module.exports = router;
