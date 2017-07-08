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
    Event._init(new TasksStartedEvent(service, rawEvent), cb);
  }
}

module.exports = TasksStartedEvent;
