'use static'

const Event = require('./event');
const AWS = require('aws-sdk');

class SteadyEvent extends Event {
  static test(rawEvent) {
    return /has\ reached\ a\ steady\ state/.test(rawEvent.message);
  }

  static convert(service, rawEvent, cb) {
    Event._init(new SteadyEvent(service, rawEvent), cb);
  }
}

module.exports = SteadyEvent;
