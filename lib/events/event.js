'use static'

const _ = require('lodash');

class Event {
  constructor(event) {
    this.raw = event;
    this.resources = {};

    _.each(this.extractableTypes(), (resourceType) => {
      this.resources[resourceType] = this._extractResources(resourceType);
    });
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
