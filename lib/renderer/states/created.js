'use strict'

const colors = require('colors/safe');

module.exports = function(deployment) {
  return {
    'done': 'Deployment created',
    'waiting': 'Waiting for tasks to start',
  }
}
