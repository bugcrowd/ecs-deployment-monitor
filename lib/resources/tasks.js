'use strict'

const { ECS } = require("@aws-sdk/client-ecs");

module.exports = function (service, tasks, cb) {
  const params = {
    cluster: service.options.clusterArn,
    tasks: tasks
  };
  const region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const ecs = new ECS({ region: region });

  ecs.describeTasks(params)
    .then((data) => cb(null, data['tasks']))
    .catch((err), cb(err));
};
