'use strict';

module.exports = function (deployment, cb) {
  if (!deployment.hasState('Live')) return cb(null, false);

  const runningTasks = deployment.service.runningTasks();

  // Get a list of tasks that do not belong to this deployment
  const oldTasks = runningTasks.filter(task => !deployment.doesTaskBelong(task));
  if (oldTasks.length === 0) return cb(null, true);

  const oldHealthTasks = oldTasks.filter(task => deployment.service.isTaskHealthy(task.taskArn));
  cb(null, oldHealthTasks.length === 0);
}
