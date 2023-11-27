'use strict'

module.exports = function (deployment, cb) {
  var desiredCount = deployment.service.raw.desiredCount;
  var failureRate = deployment.tasksFailed.length / desiredCount;

  return cb(null, failureRate > deployment.options.failureThreshold);
}
