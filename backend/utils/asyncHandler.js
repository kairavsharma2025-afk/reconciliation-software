// Wraps async route handlers so thrown errors flow into Express error middleware
// instead of crashing the process as unhandled rejections.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
