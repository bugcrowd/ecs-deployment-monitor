'use strict'

const AWS = require('aws-sdk');
const _ = require('lodash');

module.exports = function(deployment, cb) {
  if (deployment.hasState('StartingTasks')) return cb();

  var activeTasks = deployment.activeTasks();
  var healthTasks = _.filter(activeTasks, (taskArn) => deployment.isTaskHealthy(taskArn));

  cb(null, healthTasks.length >= deployment.service.raw.desiredCount);
}
