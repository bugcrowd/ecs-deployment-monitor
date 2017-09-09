'use strict'

const AWS = require('aws-sdk');
const Service = require('./lib/service');
const Deployment = require('./lib/deployment');

module.exports = function(options) {
  // Set the default region to 'us-east-1' if not already set
  if (!AWS.config.region) {
    AWS.config.update({
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
    });
  }

  let service = new Service({
    serviceName: options.serviceName,
    clusterArn: options.clusterArn
  });

  let deployment = new Deployment({
    taskDefinitionArn: options.taskDefinitionArn,
    service: service
  });

  deployment.on('end', (state) => {
    service.destroy();
    deployment.destroy();
  });

  return deployment;
}
