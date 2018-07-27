'use strict'

const _ = require('lodash');
const colors = require('colors/safe');

module.exports = function(deployment) {
  let extraMsg = "\nFailure Reasons\n";
  _.each(deployment.tasksFailedFull, (task) => {
    extraMsg += `\nTask: ${task.taskArn}\nReason: ${task.stoppedReason}\n`
  });

  return {
    'done': `${deployment.tasksFailed.length} Tasks have failed`,
    'extra': extraMsg,
    'exitCode': 1
  }
}
