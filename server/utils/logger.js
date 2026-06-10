// Simple logger that works without winston installed
// Falls back gracefully if winston not available
let winston;
try { winston = require('winston'); } catch(e) { winston = null; }

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function formatMsg(level, message, meta) {
  const ts = new Date().toISOString();
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  return `[${ts}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  error: (msg, meta) => console.error(formatMsg('error', msg, meta)),
  warn:  (msg, meta) => console.warn(formatMsg('warn', msg, meta)),
  info:  (msg, meta) => console.log(formatMsg('info', msg, meta)),
  debug: (msg, meta) => process.env.NODE_ENV !== 'production' && console.log(formatMsg('debug', msg, meta)),
};

module.exports = logger;
