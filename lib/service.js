'use strict'

const AWS = require('aws-sdk');
const EventEmitter = require('events');
const async = require('async');
const _ = require('lodash');

const serviceEvents = require('./events');

class Service extends EventEmitter {
  constructor(options) {
    super();
    this.stop = false;

    this.options = _.defaults(options, {
      durationBetweenPolls: 1000
    });

    // Only emit events created after this datetime
    this.eventsAfter = null;

    async.nextTick(this.update.bind(this));

    this.pollInterval = setInterval(this.update.bind(this), this.options.durationBetweenPolls);
  }

  /**
   * Fetch service details from AWS
   *
   * @param {function} cb Callback
   */
  _fetchService(cb) {
    var ecs = new AWS.ECS();

    var params = {
      services: [this.options.serviceName],
      cluster: this.options.cluster
    };

    ecs.describeServices(params, (err, data) => {
      if (err) return cb(err);
      cb(null, data['services'][0]);
    });
  }

  /**
   * Update to lastest service details and emit new events
   *
   * @param {boolean} force force an update
   * @param {function} cb Callback
   */
  update(force) {
    this._fetchService((err, service) => {
      if (err) return this.emit('error', err);

      if (!service) {
        return this.emit('error', new Error("A service update was not returned"));
      }

      this.service = service;
      this.primaryDeployment = _.find(this.service['deployments'], (deployment) => deployment.status === "PRIMARY");
      if (!this.primaryDeployment) {
        return this.emit('error', new Error(`No primary deployment for "${this.service.taskDefinition}"`));
      }

      this._emitNewEvents();
    });
  }

  _pluckEventsSince(events, timestamp) {
    return _.filter(events, (event) => event.createdAt > timestamp);
  }

  _emitNewEvents() {
    // If this.eventsAfter is null use the createdAt date from the primary deployment
    if (!this.eventsAfter) {
      this.eventsAfter = this.primaryDeployment.createdAt;
    }

    var events = this._pluckEventsSince(this.service.events, this.eventsAfter);
    events = _.sortBy(events, 'createdAt');
    
    if (events.length > 0) this.eventsAfter = _.last(events).createdAt;

    async.map(events, this._convertEvent.bind(this), (err, events) => {
      if (err) return this.emit('error', err);

      events.forEach((event) => this.emit('event', event));
    });
  }

  _convertEvent(rawEvent, cb) {
    var eventClassTestOrder = [
      serviceEvents.tasksStarted,
      serviceEvents.event
    ];

    var eventClass = _.find(eventClassTestOrder, (type) => type.test(rawEvent));
    eventClass.convert(this, rawEvent, cb);
  }

  destroy() {
    clearTimeout(this.pollInterval);
  }
}

module.exports = Service;
