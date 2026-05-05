const logger = require('./logger');

// Express error-handling middleware. Must take 4 args.
module.exports = function errorHandler(err, _req, res, _next) {
  logger.error(err.message, { stack: err.stack });
  const status = err.status || 500;
  res.status(status).json({
    error: err.publicMessage || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
};
