'use strict';

module.exports = function (deployment, cb) {
  if (!deployment.hasState('Live')) return cb(null, false);

  var runningTasks = deployment.service.runningTasks();

  // Get a list of tasks that do not belong to this deployment
  var oldTasks = runningTasks.filter(task => !deployment.doesTaskBelong(task));
  if (oldTasks.length === 0) return cb(null, true);

  var oldHealthTasks = oldTasks.filter(task => deployment.service.isTaskHealthy(task.taskArn));
  cb(null, oldHealthTasks.length === 0);
}
