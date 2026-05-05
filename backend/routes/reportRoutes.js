const express = require('express');
const { listRuns, getRun, getRunRows, downloadRunCsv } = require('../controllers/reportController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/runs', asyncHandler(listRuns));
router.get('/runs/:id', asyncHandler(getRun));
router.get('/runs/:id/rows', asyncHandler(getRunRows));
router.get('/runs/:id/csv', asyncHandler(downloadRunCsv));

module.exports = router;
