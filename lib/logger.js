'use strict'

const { createLogger, format, transports } = require('winston');

var level = process.env['LOG_LEVEL'] || 'error';

var filterLogTypes = format((log, opts) => {
  if (!process.env['LOG_TYPES']) return log;
  var types = process.env['LOG_TYPES'].split(',');

  if (types.includes(log.type)) return log;
  return false;
});

var logger = createLogger({
  level: level,
  format: format.combine(
    filterLogTypes(),
    format.simple()
  ),
  transports: [new transports.Console()]
});

module.exports = logger;
