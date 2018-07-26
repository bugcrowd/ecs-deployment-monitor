'use strict'

const colors = require('colors/safe');

module.exports = function(deployment) {
  return {
    'done': colors.gray('Deployment created'),
    'waiting': 'Waiting for tasks to start',
  }
}
