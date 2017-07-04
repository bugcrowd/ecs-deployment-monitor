'use strict'

const _ = require('lodash');

module.exports = function(deployment, cb) {
  if (deployment.isFailure() || !deployment.hasState('Created')) return cb();

  return cb(null, deployment.tasksStarted.length > 0);
}
