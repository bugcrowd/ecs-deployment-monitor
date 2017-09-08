'use strict'

const AWS = require('aws-sdk');
const _ = require('lodash');

module.exports = function(deployment, cb) {
  if (!deployment.hasState('Live')) return cb(null, false);

  var runningTasks = deployment.service.runningTasks();

  // Get a list of tasks that do not belong to this deployment
  var oldTasks = _.filter(runningTasks, (task) => !deployment.doesTaskBelong(task));
  if (oldTasks.length === 0) return cb(null, true);

  var oldHealthTasks = _.filter(oldTasks, (task) => deployment.service.isTaskHealthy(task.taskArn));
  cb(null, oldHealthTasks.length === 0);
}
