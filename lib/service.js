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
    this.clusterContainerInstances = [];
    this.initiated = false;
    this.stop = false;
    this.eventBuffer = async.queue(this._eventBufferWorker.bind(this));

    this.options = _.defaults(options, {
      durationBetweenPolls: 3000
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
    async.series([
      (next) => {
        this._fetchService((err, data) => {
          if (err) return next(err);
          this.raw = data;
          this.primaryDeployment = _.find(this.raw['deployments'], (deployment) => deployment.status === "PRIMARY");
          next();
        });
      },

      (next) => {
        this._clusterContainerInstances((err, instances) => {
          if (err) return next(err);
          this.clusterContainerInstances = instances;
          next();
        });
      }
    ], (err) => {
      if (err) return this.emit('error', err);
      this.initiated = true;
      this.emit('updated');
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

  targetGroupConnections(cb) {
    var alb = AWS.ELBv2();
    var lbs = _.filter(this.service.raw.loadBalancers, (lb) => !!lb.targetGroupArn);

    async.map(lbs, (lb, done) => {
      alb.describeTargetHealth({ TargetGroupArn: lb.targetGroupArn }, (err, data) => {
        if (err) return done(err);
        lb.targetHealthDescriptions = data.TargetHealthDescriptions;
        done(null, lb);
      });
    }, cb);
  }

  /**
   * Fetch Cluster Container Instances
   *
   * @param {function} cb Callback
   */
  _clusterContainerInstances(cb) {
    var ecs = new AWS.ECS();
    var ec2 = new AWS.EC2();

    async.waterfall([
      (done) => {
        var params = { cluster: this.options.clusterArn };
        ecs.listContainerInstances(params, done);
      },

      (results, done) => {
        var params = {
          cluster: this.options.clusterArn,
          containerInstances: results.containerInstanceArns
        };

        ecs.describeContainerInstances(params, done);
      },

      // Fetch the PrivateIpAddress for each Container instance
      (results, done) => {
        var instanceIds = _.map(results.containerInstances, (ci) => ci.ec2InstanceId);
        var params = { InstanceIds: instanceIds };

        ec2.describeInstances(params, (err, ec2Results) => {
          if (err) return done(err);

          var ec2Instances = _.flatten(
            _.map(ec2Results.Reservations, (reservation) => reservation.Instances)
          );

          var containerInstances = _.map(results.containerInstances, (ci) => {
            var ec2Instance = _.find(ec2Instances, (instance) => instance.InstanceId === ci.ec2InstanceId);
            ci.PrivateIpAddress = ec2Instance.PrivateIpAddress;
            return ci;
          });

          done(null, containerInstances);
        });
      }
    ], cb);
  }
}

module.exports = Service;
