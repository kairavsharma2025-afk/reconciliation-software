const fs = require('fs');
const { parseCsv } = require('../services/csvService');
const txModel = require('../models/transactionModel');
const audit = require('../audit/auditService');
const logger = require('../utils/logger');

async function uploadCsvs(req, res) {
  const sources = ['bank', 'gateway', 'ledger'];
  const summary = {};

  for (const source of sources) {
    const file = req.files?.[source]?.[0];
    if (!file) continue;
    try {
      const rows = await parseCsv(file.path);
      const tagged = rows.map((r) => ({ ...r, source }));
      const inserted = await txModel.bulkInsert(tagged);
      summary[source] = { parsed: rows.length, inserted, originalName: file.originalname };
      logger.info(`Ingested ${inserted} rows from ${source} (${file.originalname})`);
    } finally {
      fs.unlink(file.path, () => {});
    }
  }

  if (Object.keys(summary).length === 0) {
    audit.log({
      action: 'transactions.upload',
      context: req.context,
      result: 'failure',
      metadata: { error: 'no files received' },
    });
    return res.status(400).json({
      error: 'No CSV files received. Use field names: bank, gateway, ledger.',
    });
  }

  audit.log({
    action: 'transactions.upload',
    context: req.context,
    targetType: 'transactions',
    metadata: { summary },
  });
  res.json({ ok: true, summary });
}

async function clearAll(req, res) {
  await txModel.deleteAll();
  audit.log({
    action: 'transactions.cleared',
    context: req.context,
    targetType: 'transactions',
  });
  res.json({ ok: true });
}

module.exports = { uploadCsvs, clearAll };
