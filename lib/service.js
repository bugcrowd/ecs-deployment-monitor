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

    // Listen for when we add or remove listeners to the "event" event.
    // So we only poll for service updates when someone is listening
    this.on('addListener', (event, listner) => {
      if (event !== 'event') return;
      this.poll = true;
    });

    this.on('removeListener', (event, listner) => {
      if (event !== 'event' || this.listenerCount('event') !== 0) return;
      this.poll = false;
    });

    this.update(true);

    this.poll = setInterval(() => this.update(), this.options.durationBetweenPolls);
  }

  /**
   * Fetch service details from AWS
   *
   * @param {function} cb Callback
   */
  _fetchService(cb) {
    var ecs = new AWS.ECS();

    var params = {
      services: [this.options.service],
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
    if (!this.poll && !force) return;

    this._fetchService((err, service) => {
      if (err) return this.emit('error', err);

      if (!service) {
        return this.emit('error', new Error("A service update was not returned"));
      }

      this.service = service;
      this._emitNewEvents();
    });
  }

  _pluckEventsSince(events, timestamp) {
    return _.filter(events, (event) => event.createdAt > timestamp);
  }

  _emitNewEvents() {
    // If this.eventsAfter is null use the createdAt date from the primary deployment
    if (!this.eventsAfter) {
      var deployment = _.find(this.service['deployments'], (deployment) => deployment.taskDefinition === this.service.taskDefinition);
      if (!deployment) {
        return this.emit('error', new Error(`Primary deployment for "${this.service.taskDefinition}"`));
      }

      this.eventsAfter = deployment.createdAt;
    }

    var events = this._pluckEventsSince(this.service.events, this.eventsAfter);
    events = _.sortBy(events, 'createdAt');

    // Convert raw ECS service events to know event objects
    async.map(events, _.bind(this._convertEvent, this), (err, events) => {
      if (err) return this.emit('error', err);

      events.forEach((event) => this.emit('event', event));
      if (events.length > 0) this.eventsAfter = _.last(events).createdAt;
    });
  }

  _convertEvent(rawEvent, cb) {
    var eventClassTestOrder = [
      serviceEvents.registerTasks,
      serviceEvents.event
    ];

    var eventClass = _.find(eventClassTestOrder, (type) => type.test(rawEvent));
    eventClass.convert(this, rawEvent, cb);
  }

  destroy() {
    clearTimeout(this.poll);
  }
}

module.exports = Service;
