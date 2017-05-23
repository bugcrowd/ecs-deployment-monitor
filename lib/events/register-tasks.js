'use static'

const Event = require('./event');

class RegisterTasksEvent extends Event {
  extractableTypes() {
    return ['task'];
  }

  static test(rawEvent) {
    return /has\ started\ \d+\ tasks/.test(rawEvent.message);
  }

  static convert(rawEvent, cb) {
    var event = new RegisterTasksEvent(rawEvent);

    event._loadTasks((err, data) => {
      if (err) return cb(err);
      event.tasks = data.tasks;

      cb(null, event);
    });
  }

  _loadTasks(cb) {
    var params = {
      tasks: this.resources.task
    };

    var ecs = require('aws-sdk').ECS();

    ecs.describeTasks(params, cb);
  }
}

module.exports = RegisterTasksEvent;
