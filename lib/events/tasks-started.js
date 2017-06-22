'use static'

const Event = require('./event');
const AWS = require('aws-sdk');

class TasksStartedEvent extends Event {
  extractableTypes() {
    return ['task'];
  }

  static test(rawEvent) {
    return /has\ started\ \d+\ tasks/.test(rawEvent.message);
  }

  static convert(service, rawEvent, cb) {
    var event = new TasksStartedEvent(service, rawEvent);
    event.loadResources((err) => {
      if (err) return cb(err);
      cb(null, event);
    });
  }
}

module.exports = TasksStartedEvent;
