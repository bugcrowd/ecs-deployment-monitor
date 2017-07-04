'use strict'

module.exports = function(deployment, cb) {
  return cb(null, deployment.tasksStarted.length > 0);
}
