'use strict'

const colors = require('colors/safe');

module.exports = function(deployment) {
  return {
    'done': `${deployment.tasksStarted.length} Tasks have started`,
    'waiting': 'Waiting for new tasks to connect to the loadbalancer'
  }
}
