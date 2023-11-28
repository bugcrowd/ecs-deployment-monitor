'use strict'

module.exports = function (deployment, cb) {
  const primaryDeployment = deployment.service.raw['deployments'].find(d => d.status === "PRIMARY");
  return cb(null, primaryDeployment.taskDefinition !== deployment.options.taskDefinitionArn);
}
