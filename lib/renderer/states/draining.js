'use strict'

const colors = require('colors/safe');

module.exports = function(deployment) {
  return {
    'done': 'Old tasks are no longer serving new requests from the loadbalancer',
    'waiting': 'Waiting for active requests to old tasks to drain'
  }
}
