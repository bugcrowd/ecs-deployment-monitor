'use strict'

const colors = require('colors/safe');

module.exports = function(deployment) {
  return {
    'done': 'A newer deployment is in progress, this deployment is no longer primary deployment',
    'exitCode': 3
  }
}
