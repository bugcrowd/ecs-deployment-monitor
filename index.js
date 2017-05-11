'use strict'

const combiner = require('stream-combiner');
const AWS = require('aws-sdk');

const FormatConsoleTransformStream = require('./lib/format-console-transform-stream');
const StatusStream = require('./lib/status-stream');

module.exports = function(options) {
  AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
  });

  // var formatter = new FormatConsoleTransformStream();
  var status = new StatusStream(options);
  return status;

  // return combiner(status, formatter);
}
