'use static'

const async = require('async');
const _ = require('lodash');
const inflection = require('inflection');

const resourceLoaders = require('../resources');

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

  loadResources(cb) {
    let mapper = (ids, type, next) => resourceLoaders[type](this.service, ids, next);

    async.mapValues(this.resources, mapper, (err, resources) => {
      if (err) return next;
      _.each(_.keys(resources), (type) => this[inflection.pluralize(type)] = resources[type]);
      cb();
    });
  }
}

module.exports = Event;
