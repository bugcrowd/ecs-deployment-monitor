'use strict'

const colors = require('colors/safe');

module.exports = function (deployment) {
  let extraMsg = "\nFailure Reasons\n";
  deployment.tasksFailedFull.forEach((task) => {
    extraMsg += `\nTask: ${task.taskArn}\nReason: ${task.stoppedReason}\n`

    // The above stopped reason is often generic for the whole task, and doesn't
    // give a lot of context about why an individual container stopped. So let's
    // dig into the individual containers and print their own stopped reasons as well.
    task.containers.forEach((container) => {
      if (container.exitCode !== 0) {
        extraMsg += `  Container: ${container.name} (${container.lastStatus})\n`
        extraMsg += `    Exit code: ${container.exitCode}\n`

        if (container.reason) {
          extraMsg += `    Reason: ${container.reason}\n`
        }
      }
    })
  });

  return {
    'done': `${deployment.tasksFailed.length} Tasks have failed`,
    'extra': extraMsg,
    'exitCode': 1
  }
}
