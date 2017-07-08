'use strict'

const AWS = require('aws-sdk');

module.exports = function(deployment, cb) {
  if (!deployment.hasState('Live')) return cb(null, false);

  cb(null, deployment.steady);
}
