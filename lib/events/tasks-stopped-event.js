'use static'

const Event = require('./event');
const AWS = require('aws-sdk');

class TasksStoppedEvent extends Event {
  extractableTypes() {
    return ['task'];
  }

  static test(rawEvent) {
    return /has\ stopped\ \d+\ running\ tasks/.test(rawEvent.message);
  }

  static convert(service, rawEvent, cb) {
    var event = new TasksStoppedEvent(service, rawEvent);
    event.loadResources((err) => {
      if (err) return cb(err);
      cb(null, event);
    });
  }
}

module.exports = TasksStoppedEvent;
