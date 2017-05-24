'use static'

const Event = require('./event');
const AWS = require('aws-sdk');

class RegisterTasksEvent extends Event {
  extractableTypes() {
    return ['task'];
  }

  static test(rawEvent) {
    return /has\ started\ \d+\ tasks/.test(rawEvent.message);
  }

  static convert(service, rawEvent, cb) {
    var event = new RegisterTasksEvent(service, rawEvent);

    event._loadTasks((err, data) => {
      if (err) return cb(err);
      event.tasks = data.tasks;

      cb(null, event);
    });
  }

  _loadTasks(cb) {
    var params = {
      cluster: this.service.options.cluster,
      tasks: this.resources.task
    };

    var ecs = new AWS.ECS();

    ecs.describeTasks(params, cb);
  }
}

module.exports = RegisterTasksEvent;
