'use strict'

const colors = require('colors/safe');

module.exports = function(deployment) {
  return {
    'done': 'All tasks are live and serving requests',
    'waiting': 'Waiting for old tasks to disconnect from the loadbalancer'
  }
}
