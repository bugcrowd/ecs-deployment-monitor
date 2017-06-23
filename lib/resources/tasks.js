'use strict'

const AWS = require('aws-sdk');

module.exports = function(service, tasks, cb) {
  var params = {
    cluster: service.options.clusterArn,
    tasks: tasks
  };

  var ecs = new AWS.ECS();

  ecs.describeTasks(params, (err, data) => {
    if (err) return cb(err);
    cb(null, data['tasks']);
  });
}
