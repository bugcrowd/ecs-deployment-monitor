'use strict'

const _ = require('lodash');

module.exports = function(deployment, cb) {
  var primaryDeployment = _.find(deployment.service.raw['deployments'], (d) => d.status === "PRIMARY");
  return cb(null, primaryDeployment.taskDefinition !== deployment.options.taskDefinitionArn);
}
