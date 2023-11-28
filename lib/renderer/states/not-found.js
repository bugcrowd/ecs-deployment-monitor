'use strict'

const colors = require('colors/safe');

module.exports = function (deployment) {
  return {
    'done': `ECS Deployment for task definition "${deployment.options.taskDefinitionArn}" not found`,
    'exitCode': 2
  }
}
