require('dotenv').config();
const express = require('express');
const cors = require('cors');

const requestContext = require('./middleware/requestContext');
const logger = require('./utils/logger');
const errorHandler = require('./utils/errorHandler');
const worker = require('./jobs/worker');

const uploadRoutes = require('./routes/uploadRoutes');
const reconcileRoutes = require('./routes/reconcileRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const jobRoutes = require('./routes/jobRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();
app.set('trust proxy', true);

app.use(cors());
app.use(express.json());
app.use(requestContext);

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, { reqId: req.context.requestId });
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/upload', uploadRoutes);
app.use('/api/reconcile', reconcileRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  logger.info(`API listening on http://localhost:${PORT}`);
  if (process.env.WORKER_ENABLED !== 'false') {
    worker.start();
  } else {
    logger.info('worker disabled (WORKER_ENABLED=false)');
  }
});

// Graceful shutdown — finish in-flight requests, stop the worker poll loop.
function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  worker.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
