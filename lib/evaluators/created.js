'use strict'

module.exports = function (deployment, cb) {
  var rawDeployment = deployment.service.raw['deployments'].find((d) => {
    return d.taskDefinition === deployment.options.taskDefinitionArn;
  });

  return cb(null, !!rawDeployment);
}
