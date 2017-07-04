'use strict'

const _ = require('lodash');

module.exports = function(deployment, cb) {
  var rawDeployment = _.find(deployment.service.raw['deployments'], (d) => {
    return d.taskDefinition === deployment.options.taskDefinitionArn;
  });

  // Set state as Created if raw deployment exists and deployment hasn't
  // entered "Created" state yet
  var created = (
    !!rawDeployment &&
    !deployment.hasState('Created')
  )

  return cb(null, created);
}
