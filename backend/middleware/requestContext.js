const { v4: uuid } = require('uuid');

// Attaches a per-request context object. Anything that wants to attribute
// an action (audit, logs, errors) reads from req.context.
//
// In a real app, `actor` would come from a signed JWT or session cookie.
// We default to 'anonymous' since this app has no auth layer.
module.exports = function requestContext(req, _res, next) {
  req.context = {
    requestId: req.get('x-request-id') || uuid(),
    actor: req.get('x-actor') || 'anonymous',
    ip: req.ip,
    startedAt: Date.now(),
  };
  next();
};
