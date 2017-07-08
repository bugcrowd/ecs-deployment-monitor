'use strict'

const AWS = require('aws-sdk');
const EventEmitter = require('events');
const async = require('async');
const _ = require('lodash');

const events = require('./events');
const evaluators = require('./evaluators');

class Deployment extends EventEmitter {
  constructor(options) {
    super();

    _.defaults(options, {
      durationBetweenPolls: 1000,
      failedDeployRate: .25
    });

    this.options = options;

    this.tasks = [];
    this.tasksStarted = [];
    this.tasksFailed = [];
    this.steady = false;

    this.history = [];

    this.service = options.service;

    this.service.on('event', this._serviceEventListener.bind(this));

    this.evaluateInterval = setInterval(() => {
      this.evaluate(evaluators, _.noop);
    }, this.options.durationBetweenPolls);
  }

  _serviceEventListener(event) {
    var filterDeploymentTasks = (tasks) => {
      return _.filter(event.tasks, (task) => task.taskDefinitionArn === this.options.taskDefinitionArn);
    }

    if (event instanceof events.TasksStartedEvent) {
      let deploymentTasks = filterDeploymentTasks(event.tasks);
      this.tasks.push.apply(this.tasks, deploymentTasks);
      this.tasksStarted.push.apply(this.tasksStarted, _.map(deploymentTasks, (task) => task.taskArn));
    }

    if (event instanceof events.TasksStoppedEvent) {
      let deploymentTasks = filterDeploymentTasks(event.tasks);
      this.tasksFailed.push.apply(this.tasksFailed, _.map(deploymentTasks, (task) => task.taskArn));
    }

    if (event instanceof events.SteadyEvent) {
      this.steady = true;
    }
  }

  /**
   * evaluate
   *
   * Evaluate the known state of the universe and consolidate it a set of digestible
   * known states.
   *
   * @param {object} evaluators A map of { state: evaluator } to use in evaluaton of
   * @return {array}
   */
  evaluate(evaluators, cb) {
    // Skip evaluation if service is not initiated or has failed
    if (!this.service.initiated || this.isFailure()) return cb();

    async.eachSeries(Deployment.evaluationOrder, (state, done) => {
      var evaluator = evaluators[state];
      if (!evaluator || this.hasState(state)) return done();

      evaluator(this, (err, result) => {
        if (err || !result) return done(err);
        this.setState(state);
        done();
      });
    }, cb);
  }

  /**
   * getTask
   *
   * @param {string} taskArn The ARN of the Task
   * @return {object}
   */
  getTask(taskArn) {
    return _.find(this.tasks, (task) => task.taskArn === taskArn);
  }

  /**
   * activeTasks
   *
   * A list of Tasks that have started but not stopped.
   *
   * @return {array}
   */
  activeTasks() {
    return _.difference(this.tasksStarted, this.tasksFailed);
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
    var task = this.getTask(taskArn);
    var containerInstance = this.service.getContainerInstance(task.containerInstanceArn);

    var healthy = _.every(this.service.raw.loadBalancers, (lb) => {
      var container = _.find(task.containers, (container) => container.name === lb.containerName);
      var targets = _.filter(_.map(container.networkBindings, (binding) => {
        return this.service.getTarget(containerInstance.ec2InstanceId, binding.hostPort);
      }, (target) => !!target));

      return _.every(targets, (target) => 'healthy' === target.TargetHealth.State);
    });

    return healthy;
  }

  /**
   * setState
   *
   * Change the state this deployment is in
   *
   * @param {string} state the state to set
   * @return {boolean}
   */
  setState(state) {
    this.state = state;
    this.history.push({ state: this.state, transitionedAt: Date.now()});
    this.emit('state', state);
  }

  /**
   * destroy
   *
   * Stop the evaluation interval.
   */
  destroy() {
    clearTimeout(this.evaluateInterval);
  }

  /**
   * isFailure
   *
   * Has this deployment entered into a state that is considered a
   * Failed state?
   *
   * @return {boolean}
   */
  isFailure() {
    return !!_.find(this.history, (item) => {
      return Deployment.failureStates.indexOf(item.state) !== -1;
    });
  }

  /**
   * hasState
   *
   * Has this deployment entered into the provided state?
   *
   * @param {string} state the state to test
   * @return {boolean}
   */
  hasState(state) {
    return !!_.find(this.history, (item) => item.state === state);
  }
}

Deployment.evaluationOrder = [
  'NotFound',
  'Usurped',
  'Created',
  'StartingTasks',
  'FailedTasks',
  'Live',
  'RollingOut',
  'Stable'
]

Deployment.failureStates = ['NotFound', 'Usurped', 'FailedTasks'];

module.exports = Deployment;
