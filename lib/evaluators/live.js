'use strict';

module.exports = function (deployment, cb) {
  if (!deployment.hasState('TasksStarted')) return cb(null, false);

  const activeTasks = deployment.activeTasks();
  const healthTasks = activeTasks.filter(taskArn => deployment.service.isTaskHealthy(taskArn));

  cb(null, healthTasks.length >= deployment.service.raw.desiredCount);
}
