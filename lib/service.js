'use strict'

const AWS = require('aws-sdk');
const EventEmitter = require('events');
const async = require('async');
const _ = require('lodash');

const serviceEvents = require('./events');

class Service extends EventEmitter {
  constructor(options) {
    super();
    // Only emit events created after this datetime
    this.eventsAfter = null;
    this.primaryDeployment = null;
    this.initiated = false;
    this.stop = false;
    this.eventBuffer = async.queue(this._eventBufferWorker.bind(this));
    this.loadBalancers = [];

    this.options = _.defaults(options, {
      durationBetweenPolls: 1000
    });

    this.on('updated', this._fetchEvents.bind(this));

    process.nextTick(this.update.bind(this));
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
      cluster: this.options.clusterArn
    };

    ecs.describeServices(params, (err, data) => {
      if (err) return cb(err);
      cb(null, data['services'][0]);
    });
  }

  /**
   * Update to lastest service details and emit new events
   */
  update() {
    this._fetchService((err, data) => {
      if (err) return this.emit('error', err);

      if (!data) {
        return this.emit('error', new Error("A service update was not returned"));
      }

      this.raw = data;
      this.primaryDeployment = _.find(this.raw['deployments'], (deployment) => deployment.status === "PRIMARY");

      this._loadTargetGroups((err) => {
        if (err) this.emit('error', err);
        this.initiated = true;
        this.emit('updated');
      });
    });
  }

  _pluckEventsSince(events, timestamp) {
    return _.filter(events, (event) => event.createdAt > timestamp);
  }

  _fetchEvents() {
    if (!this.primaryDeployment) return;

    if (!this.eventsAfter) {
      this.eventsAfter = this.primaryDeployment.createdAt;
    }

    var events = _.filter(this.raw.events, (event) => event.createdAt > this.eventsAfter);
    events = _.sortBy(events, 'createdAt');

    if (events.length > 0) this.eventsAfter = _.last(events).createdAt;

    this.eventBuffer.push.apply(this.eventBuffer, events);
  }

  _loadTargetGroups(cb) {
    if (this.raw.loadBalancers.length == 0 || this.loadBalancers.length > 0) return cb();

    var alb = new AWS.ELBv2();

    // Disregard Load Balancers which do not have a target group
    var lbs = _.filter(this.raw.loadBalancers, (lb) => !!lb.targetGroupArn);

    async.map(lbs, (lb, done) => {
      alb.describeTargetGroups({ TargetGroupArns: [ lb.targetGroupArn ] }, (err, data) => {
        if (err) return done(err);

        done(null, {
          targetGroup: data.TargetGroups[0],
          containerName: lb.containerName,
          containerPort: lb.containerPort
        })
      });
    }, (err, results) => {
      if (err) return cb(err);

      this.loadBalancers = results;
      cb();
    })
  }

  /**
   * Event Buffer Worker
   *
   * Ensures events are process synchronously.
   *
   * @param {object} event The event to process
   * @param {function} cb Callback
   */
  _eventBufferWorker(event, cb) {
    this._convertEvent(event, (err, eventObj) => {
      if (err) return this.emit('error', err);

      this.emit('event', eventObj);
      cb();
    });
  }

  /**
   * Convert Event
   *
   * Converts an event from a raw ECS Service event into a known Event Object
   *
   * @param {object} event The event to process
   * @param {function} cb Callback
   */
  _convertEvent(rawEvent, cb) {
    var eventClassTestOrder = [
      serviceEvents.TasksStartedEvent,
      serviceEvents.Event
    ];

    var eventClass = _.find(eventClassTestOrder, (type) => type.test(rawEvent));
    eventClass.convert(this, rawEvent, cb);
  }

  destroy() {
    clearTimeout(this.pollInterval);
  }
}

module.exports = Service;
