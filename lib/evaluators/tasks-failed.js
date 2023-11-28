'use strict'

module.exports = function (deployment, cb) {
  const desiredCount = deployment.service.raw.desiredCount;
  const failureRate = deployment.tasksFailed.length / desiredCount;

  return cb(null, failureRate > deployment.options.failureThreshold);
}
