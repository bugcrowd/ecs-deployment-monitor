'use static';
const Event = require('./event');

class TasksStoppedEvent extends Event {
  extractableTypes() {
    return ['task'];
  }

  static test(rawEvent) {
    return /has\ stopped\ \d+\ running\ tasks/.test(rawEvent.message);
  }

  static convert(service, rawEvent, cb) {
    Event._init(new TasksStoppedEvent(service, rawEvent), cb);
  }
}

module.exports = TasksStoppedEvent;
