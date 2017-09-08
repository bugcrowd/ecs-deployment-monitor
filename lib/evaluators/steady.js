'use strict'

const AWS = require('aws-sdk');

module.exports = function(deployment, cb) {
  cb(null, deployment.steady);
}
