'use static'

const _ = require('lodash');

class Event {
  constructor(service, event) {
    this.service = service;
    this.raw = event;
    this.resources = {};

    _.each(this.extractableTypes(), (resourceType) => {
      this.resources[resourceType] = this._extractResources(resourceType);
    });
  }

  static test(rawEvent) {
    return true;
  }

  static convert(service, rawEvent, cb) {
    var event = new Event(service, rawEvent);
    return cb(null, event);
  }

  extractableTypes() {
    return [];
  }

  _extractResources(type) {
    var regexStr = `\\(${type} ([^\\)]+)`
    var regex = new RegExp(regexStr, 'g');
    var matches = this.raw.message.match(regex);
    if (!matches) return [];

    return _.map(matches, (match) => match.match(regexStr)[1]);
  }
}

module.exports = Event;
