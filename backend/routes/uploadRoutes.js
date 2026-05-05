const express = require('express');
const multer = require('multer');
const path = require('path');

const { uploadCsvs, clearAll } = require('../controllers/uploadController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    if (!/\.csv$/i.test(file.originalname)) return cb(new Error('Only .csv files are accepted'));
    cb(null, true);
  },
});

const fields = upload.fields([
  { name: 'bank', maxCount: 1 },
  { name: 'gateway', maxCount: 1 },
  { name: 'ledger', maxCount: 1 },
]);

router.post('/', fields, asyncHandler(uploadCsvs));
router.delete('/', asyncHandler(clearAll));

module.exports = router;
