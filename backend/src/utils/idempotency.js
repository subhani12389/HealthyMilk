const crypto = require('crypto');

function getIdempotencyKey(req, actorId, operation) {
  const key = String(req.get('Idempotency-Key') || '').trim();
  if (key.length < 16 || key.length > 200) return null;
  return crypto.createHash('sha256')
    .update(`${actorId}:${operation}:${key}`)
    .digest('hex');
}

function hashPayload(payload) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

module.exports = { getIdempotencyKey, hashPayload };
