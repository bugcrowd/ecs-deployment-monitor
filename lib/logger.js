'use strict'

const { createLogger, format, transports } = require('winston');

const level = process.env['LOG_LEVEL'] || 'error';

const filterLogTypes = format((log, opts) => {
  if (!process.env['LOG_TYPES']) return log;
  const types = process.env['LOG_TYPES'].split(',');

  if (types.includes(log.type)) return log;
  return false;
});

const logger = createLogger({
  level: level,
  format: format.combine(
    filterLogTypes(),
    format.simple()
  ),
  transports: [new transports.Console()]
});

module.exports = logger;
