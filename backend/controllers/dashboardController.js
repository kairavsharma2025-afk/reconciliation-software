const txModel = require('../models/transactionModel');

async function getStats(_req, res) {
  const stats = await txModel.getStats();
  res.json({ ok: true, stats });
}

module.exports = { getStats };
