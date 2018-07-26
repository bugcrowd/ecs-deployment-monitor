'use strict'

const colors = require('colors/safe');

module.exports = function(deployment) {
  return {
    'done': colors.green('Deployment was successful'),
    'exitCode': 0
  }
}
