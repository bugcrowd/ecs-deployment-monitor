'use strict';
const _ = require('lodash');

module.exports = function(deployment, cb) {
  if (!deployment.hasState('TasksStarted')) return cb(null, false);

  var activeTasks = deployment.activeTasks();
  var healthTasks = _.filter(activeTasks, (taskArn) => deployment.service.isTaskHealthy(taskArn));

  cb(null, healthTasks.length >= deployment.service.raw.desiredCount);
}
