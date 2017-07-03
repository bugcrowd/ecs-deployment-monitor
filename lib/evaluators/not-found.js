'use strict'

const _ = require('lodash');

module.exports = function(deployment, cb) {

  return cb(null, !_.find(deployment.service.raw.deployments, (d) => {
    return d.taskDefinition === deployment.options.taskDefinitionArn;
  }));
}
