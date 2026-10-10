const crypto = require('crypto');

function generateBatchId() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `HM-${date}-${String(crypto.randomInt(0, 10000)).padStart(4, '0')}`;
}

module.exports = { generateBatchId };
