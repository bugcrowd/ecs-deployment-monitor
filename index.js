'use strict'

const Service = require('./lib/service');
const Deployment = require('./lib/deployment');
const Renderer = require('./lib/renderer');

module.exports = function (options) {
  options.continueService = options.continueService || false;

  let service = new Service({
    serviceName: options.serviceName,
    clusterArn: options.clusterArn
  });

  let deployment = new Deployment({
    taskDefinitionArn: options.taskDefinitionArn,
    failureThreshold: options.failureThreshold,
    service: service,
  });

  deployment.on('end', (state) => {
    service.destroy();
    deployment.destroy();
  });

  if (options.outputStream) {
    Renderer.watch(deployment, options.outputStream);
  }

  return deployment;
}
