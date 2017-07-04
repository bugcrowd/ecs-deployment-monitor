'use strict'

module.exports = function(deployment, cb) {
  if (deployment.isFailure()) return cb();

  return cb(null, deployment.tasksStarted.length > 0);
}
