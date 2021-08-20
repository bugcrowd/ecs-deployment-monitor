'use strict';

const AWS = require('aws-sdk');
const EventEmitter = require('events');
const async = require('async');
const _ = require('lodash');

const serviceEvents = require('./events');
const logger = require('./logger');

class Service extends EventEmitter {
  constructor(options) {
    super();
    // Only emit events created after this datetime
    this.eventsAfter = null;
    this.primaryDeployment = null;
    this.clusterContainerInstances = [];
    this.targets = [];
    this.tasks = [];
    this.initiated = false;
    this.stop = false;
    this.launchType = 'EC2';
    this.eventBuffer = async.queue(this._eventBufferWorker.bind(this));

    this.options = _.defaults(options, {
      durationBetweenPolls: 3000,
    });

    this.on('updated', this._emitNewEvents.bind(this));

    process.nextTick(this.update.bind(this));
    this.pollInterval = setInterval(this.update.bind(this), this.options.durationBetweenPolls);
  }

  /**
   * Fetch service details from AWS
   *
   * @param {function} cb Callback
   */
  _service(cb) {
    const ecs = new AWS.ECS();

    const params = {
      services: [this.options.serviceName],
      cluster: this.options.clusterArn,
    };

    ecs.describeServices(params, (err, data) => {
      if (err) {
        logger.error(err.message);
        return cb(err);
      }
      logger.info('Retrieved service data for ' + data['services'][0]['serviceArn']);
      cb(null, data['services'][0]);
    });
  }

  /**
   * Fetch health for all targets
   *
   * @param {function} cb Callback
   */
  _targets(cb) {
    const alb = new AWS.ELBv2();
    const lbs = this.raw.loadBalancers.filter((lb) => !!lb.targetGroupArn);

    async.map(lbs, (lb, done) => {
      alb.describeTargetHealth({TargetGroupArn: lb.targetGroupArn}, (err, data) => {
        if (err) return done(err);
        done(null, data.TargetHealthDescriptions);
      });
    }, (err, results) => {
      if (err) return cb(err);
      cb(null, _.flatten(results));
    });
  }

  /**
   * Fetch Cluster Container Instances
   *
   * @param {function} cb Callback
   */
  _clusterContainerInstances(cb) {
    const ecs = new AWS.ECS();

    async.waterfall([
      (done) => {
        const params = {cluster: this.options.clusterArn};
        ecs.listContainerInstances(params, done);
      },

      (results, done) => {
        const params = {
          cluster: this.options.clusterArn,
          containerInstances: results.containerInstanceArns,
        };

        ecs.describeContainerInstances(params, (err, results) => {
          if (err) return done(err);
          done(null, results.containerInstances);
        });
      },
    ], cb);
  }

  /**
   * _tasks
   *
   * Fetch tasks in this Service. Returns currently active and
   * stopped tasks that have exist as part of this service for
   * one hour after stopping.
   *
   * @param {function} cb Callback
   */
  _tasks(cb) {
    const ecs = new AWS.ECS();

    async.waterfall([
      (done) => {
        const params = {
          cluster: this.options.clusterArn,
          serviceName: this.options.serviceName,
        };

        ecs.listTasks(params, done);
      },

      (results, done) => {
        // Skip describeTasks if no tasks are in this service
        if (results.taskArns.length === 0) {
          return done(null, []);
        }

        const params = {
          cluster: this.options.clusterArn,
          tasks: results.taskArns,
        };

        ecs.describeTasks(params, (err, results) => {
          if (err) return done(err);
          done(null, results.tasks);
        });
      },
    ], cb);
  }

  /**
   * _pluckEventsSince
   *
   * Filter an array of events. Returns events created after the
   * provided timestamp.
   *
   * @param {array} events A list of events to search
   * @param {integer} timestamp Select new events created after this timestamp
   * @return {array} A list of events
   */
  _pluckEventsSince(events, timestamp) {
    return events.filter((event) => event.createdAt > timestamp);
  }

  /**
   * _emitNewEvents
   *
   * Emit new events that have arrived since last time events
   * were emited. Called on service 'updated' event.
   */
  _emitNewEvents() {
    logger.log({level: 'info', type: 'service', message: 'Emitting new service events'});

    if (!this.primaryDeployment) return;

    if (!this.eventsAfter) {
      this.eventsAfter = this.primaryDeployment.createdAt;
    }

    let events = this.raw.events.filter((event) => event.createdAt > this.eventsAfter);
    events = _.sortBy(events, 'createdAt');

    if (events.length > 0) this.eventsAfter = _.last(events).createdAt;

    events.forEach((event) => this.eventBuffer.push(event, _.noop));
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
      logger.log({level: 'debug', type: 'service-event', message: JSON.stringify(event)});
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
    const eventClassTestOrder = [
      serviceEvents.TasksStartedEvent,
      serviceEvents.TasksStoppedEvent,
      serviceEvents.SteadyEvent,
      serviceEvents.Event,
    ];

    const eventClass = eventClassTestOrder.find((type) => type.test(rawEvent));
    eventClass.convert(this, rawEvent, cb);
  }

  /**
   * Get Targets For EC2 Task
   *
   * Finds the load balancer targets for the EC2 task based on container instances.
   *
   * @param {object} task The task we are resolving targets for.
   * @param {object} container The specific container we are looking for targets associated with.
   * @return {array} A list of targets
   */
  _getTargetsForEC2Task(task, container) {
    const containerInstance = this.getContainerInstance(task.containerInstanceArn);

    return container.networkBindings.map((binding) => {
      return this.getTarget(containerInstance.ec2InstanceId, binding.hostPort);
    }).filter((target) => !!target);
  }

  /**
   * Get Targets For Fargate Task
   *
   * Finds the load balancer targets for the Fargate task based on elastic network
   * interface IPs.
   *
   * @param {object} task The task we are resolving targets for.
   * @param {object} containerPort Container port that is used with the target group.
   * @return {array} A list of targets
   */
  _getTargetsForFargateTask(task, containerPort) {
    // Fargate is slightly simpler than EC2 launch type. All tasks are registered
    // against target group with the IP of its dedicated ENI. The health of the
    // task is simply the health of the target entry for the task, which we
    // already have from the targets array. All containers in the same task use
    // the same IP (but different ports).
    // There are some caveats here - neither multiple target groups targeting
    // the same tasks (but different ports), nor IPv6 addresses are handled.
    const taskIP = task.attachments[0].details.find((detail) => detail.name === 'privateIPv4Address').value;
    logger.debug(`${task.taskArn} has IP ${taskIP} and port ${containerPort}`);

    const targetsForThisTask = this.targets.filter((target) => {
      return target.Target.Ip === taskIP && target.Target.Port === containerPort;
    });
    logger.debug(`Matched ${targetsForThisTask.length} target(s) for this task`);

    return targetsForThisTask;
  }

  /**
   * Update service, target health and cluster instance details
   */
  update() {
    logger.log({level: 'info', type: 'service', message: 'Service update initiated'});

    async.series([
      (next) => {
        this._service((err, data) => {
          if (err) return next(err);
          this.raw = data;
          this.launchType = this.raw['launchType']; // Fargate or EC2
          this.primaryDeployment = this.raw['deployments'].find((deployment) => deployment.status === 'PRIMARY');
          next();
        });
      },

      (next) => {
        this._targets((err, targets) => {
          if (err) {
            logger.error(err.message);
            return next(err);
          }

          logger.info(`Found ${targets.length} targets for this service`);
          this.targets = targets;
          next();
        });
      },

      (next) => {
        if (this.launchType === 'FARGATE') {
          logger.info('Service is of launch type Fargate, not retrieving container instances');
          return next();
        }

        this._clusterContainerInstances((err, instances) => {
          if (err) {
            logger.error(err.message);
            return next(err);
          }

          this.clusterContainerInstances = instances;
          next();
        });
      },

      (next) => {
        this._tasks((err, tasks) => {
          if (err) {
            logger.error(err.message);
            return next(err);
          }

          this.tasks = tasks;
          next();
        });
      },
    ], (err) => {
      if (err) return this.emit('error', err);
      if (this.end) return;
      this.initiated = true;
      logger.log({level: 'info', type: 'service', message: 'Service update completed'});
      this.emit('updated');
    });
  }

  /**
   * Get a Container Instance
   *
   * @param {string} containerInstanceArn The ARN of the container instance
   * @return {object}
   */
  getContainerInstance(containerInstanceArn) {
    return this.clusterContainerInstances.find((ci) =>
      ci.containerInstanceArn === containerInstanceArn );
  }

  /**
   * Get a Target
   *
   * @param {string} instanceId The EC2 InstanceId of the target
   * @param {integer} port The Port of the target
   * @return {object}
   */
  getTarget(instanceId, port) {
    return this.targets.find((target) =>
      target.Target.Id === instanceId && target.Target.Port === port);
  }


  /**
   * getTask
   *
   * Searches list of cached tasks in this service object for the desired task
   *
   * @param {string} taskArn The ARN of the Task
   * @return {object}
   */
  getTask(taskArn) {
    return this.tasks.find((task) => task.taskArn === taskArn);
  }

  /**
   * isTaskHealthy
   *
   * Determine if a Task is healthy. This is done by looking at the Healthy State on
   * all targets which belong to this task.
   *
   * @param {string} taskArn The ARN of the Task
   * @return {boolean}
   */
  isTaskHealthy(taskArn) {
    const task = this.getTask(taskArn);
    if (!task) {
      this.emit('warning', `Task ${taskArn} does not exist. Or has not been cached against the service`);
      return false;
    }

    // Most of this logic is identical for Fargate- and EC2-backed containers,
    // except for the inner logic around finding the targets.
    const isHealthy = this.raw.loadBalancers.every((lb) => {
      const container = task.containers.find((container) => container.name === lb.containerName);
      if (!container) {
        logger.error(`Found no matching LB container name for ${container.name}`);
        return false;
      }

      const targets = (this.launchType === 'FARGATE') ?
        this._getTargetsForFargateTask(task, lb.containerPort) :
        this._getTargetsForEC2Task(task, container);

      // If no targets were found for the container, then container
      // is not registered with Load Balancer yet.
      if (targets.length === 0) {
        logger.debug(`No targets for ${task.taskArn} found registered with target group ${lb.targetGroupArn}`);
        return false;
      }

      return targets.every((target) => 'healthy' === target.TargetHealth.State);
    });

    logger.info(`Health over all targets for ${taskArn} is ${isHealthy}`);
    return isHealthy;
  }

  /**
   * runningTasks
   *
   * Get a list of tasks running in this service
   */
  runningTasks() {
    return this.tasks.filter((task) => task.lastStatus === 'RUNNING');
  }

  /**
   * destroy
   *
   * Prevents future polling of AWS for service updates
   */
  destroy() {
    logger.log({level: 'info', type: 'service', message: 'Destroying Service'});
    this.end = true;
    clearTimeout(this.pollInterval);
  }
}

module.exports = Service;

