'use strict'

const _ = require('lodash');

module.exports = function(deployment, cb) {
  var rawDeployment = _.find(deployment.service.raw['deployments'], (d) => {
    return d.taskDefinition === deployment.options.taskDefinitionArn;
  });

  return cb(null, !!rawDeployment);
}
