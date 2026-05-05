const express = require('express');
const { listJobs, getJob } = require('../controllers/jobController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/', asyncHandler(listJobs));
router.get('/:id', asyncHandler(getJob));

module.exports = router;
