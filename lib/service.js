'use strict';

const { ECS } = require("@aws-sdk/client-ecs");
const { ElasticLoadBalancingV2: ELBv2 } = require("@aws-sdk/client-elastic-load-balancing-v2");
const EventEmitter = require('events');
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
    this.region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
    this.ecs = new ECS({ region: this.region });
    this.alb = new ELBv2({ region: this.region });

    this.options = _.defaults(options, {
      durationBetweenPolls: 3000,
    });

    this.on('updated', this._emitNewEvents.bind(this));

    process.nextTick(this.update.bind(this));
    this.pollInterval = setInterval(this.update.bind(this), this.options.durationBetweenPolls);
  }

  /**
   * Fetch service details from AWS
   */
  async _service() {
    const params = {
      services: [this.options.serviceName],
      cluster: this.options.clusterArn,
    };

    const data = await this.ecs.describeServices(params);
    logger.info(`Retrieved service data for ${data.services[0].serviceArn}`);
    return data.services[0];
  }

  /**
   * Fetch health for all targets
   */
  async _targets() {
    const lbs = this.raw.loadBalancers.filter((lb) => !!lb.targetGroupArn);

    const results = await Promise.all(lbs.map(async (lb) => {
      const data = await this.alb.describeTargetHealth({ TargetGroupArn: lb.targetGroupArn });
      return data.TargetHealthDescriptions;
    }));

    return results.flat();
  }

  /**
   * Fetch Cluster Container Instances
   */
  async _clusterContainerInstances() {
    const { containerInstanceArns } = await this.ecs.listContainerInstances({
      cluster: this.options.clusterArn,
    });

    const { containerInstances } = await this.ecs.describeContainerInstances({
      cluster: this.options.clusterArn,
      containerInstances: containerInstanceArns,
    });

    return containerInstances;
  }

  /**
   * _tasks
   *
   * Fetch tasks in this Service. Returns currently active and
   * stopped tasks that have exist as part of this service for
   * one hour after stopping.
   */
  async _tasks() {
    const { taskArns } = await this.ecs.listTasks({
      cluster: this.options.clusterArn,
      serviceName: this.options.serviceName,
    });

    // Skip describeTasks if no tasks are in this service
    if (taskArns.length === 0) {
      return [];
    }

    const { tasks } = await this.ecs.describeTasks({
      cluster: this.options.clusterArn,
      tasks: taskArns,
    });

    return tasks;
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
    logger.log({ level: 'info', type: 'service', message: 'Emitting new service events' });

    if (!this.primaryDeployment) return;

    if (!this.eventsAfter) {
      this.eventsAfter = this.primaryDeployment.createdAt;
    }

    const events = _(this.raw.events)
      .filter((event) => event.createdAt > this.eventsAfter)
      .sortBy('createdAt')
      .value();

    if (events.length > 0) this.eventsAfter = _.last(events).createdAt;

    const eventClassTestOrder = [
      serviceEvents.TasksStartedEvent,
      serviceEvents.TasksStoppedEvent,
      serviceEvents.SteadyEvent,
      serviceEvents.Event,
    ];

    for (const event of events) {
      logger.log({ level: 'debug', type: 'service-event', message: JSON.stringify(event) });
      const eventClass = eventClassTestOrder.find((type) => type.test(event));
      eventClass.convert(this, event, (error, value) => {
        if (error) return this.emit('error', error);
        this.emit('event', value);
      });
    }
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

    // Similar to ENI IP allocation for Fargate, occasionally there is a race
    // here between the deployment monitor and configuration of the network
    // bindings.
    if (!container.networkBindings) {
      logger.debug(`${task.taskArn} has no network bindings configured yet`);
      return [];
    }

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

    // It takes a little bit of time to attach the ENI and allocate an IP, so
    // detect that before looking for the IP address.
    const eni = task.attachments[0];
    if (eni.status === 'PRECREATED') {
      logger.debug(`${task.taskArn} ENI has not yet been allocated an IP`);
      return [];
    }

    const taskIP = eni.details.find((detail) => detail.name === 'privateIPv4Address').value;
    logger.debug(`${task.taskArn} has IP ${taskIP} and port ${containerPort}`);

    const targetsForThisTask = this.targets.filter((target) => {
      // Id attribute is used here for the IP - it's not a typo.
      return target.Target.Id === taskIP && target.Target.Port === containerPort;
    });
    logger.debug(`Matched ${targetsForThisTask.length} target(s) for this task`);

    return targetsForThisTask;
  }

  /**
   * Update service, target health and cluster instance details
   */
  async update() {
    logger.log({ level: 'info', type: 'service', message: 'Service update initiated' });

    try {
      this.raw = await this._service();
      this.launchType = this.raw.launchType;
      this.primaryDeployment = this.raw.deployments.find((deployment) =>
        deployment.status === 'PRIMARY');

      this.targets = await this._targets();
      logger.info(`Found ${this.targets.length} targets for this service`);

      if (this.launchType === 'FARGATE') {
        logger.info('Service is of launch type Fargate, not retrieving container instances');
      } else {
        this.clusterContainerInstances = await this._clusterContainerInstances();
      }

      this.tasks = await this._tasks();
    } catch (error) {
      logger.error(error.message);
      return this.emit('error', error);
    }

    if (this.end) return;

    this.initiated = true;
    logger.log({ level: 'info', type: 'service', message: 'Service update completed' });
    this.emit('updated');
  }

  /**
   * Get a Container Instance
   *
   * @param {string} containerInstanceArn The ARN of the container instance
   * @return {object}
   */
  getContainerInstance(containerInstanceArn) {
    return this.clusterContainerInstances.find((ci) =>
      ci.containerInstanceArn === containerInstanceArn);
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
    logger.log({ level: 'info', type: 'service', message: 'Destroying Service' });
    this.end = true;
    clearTimeout(this.pollInterval);
  }
}

module.exports = Service;

