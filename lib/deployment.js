'use strict'

const EventEmitter = require('events');
const async = require('async');
const _ = require('lodash');

const events = require('./events');
const evaluators = require('./evaluators');
const taskLoader = require('./resources/tasks');
const logger = require('./logger');

class Deployment extends EventEmitter {
  constructor(options) {
    super();

    _.defaults(options, {
      durationBetweenPolls: 1000,
      failureThreshold: .25
    });

    this.options = options;

    this.tasksStarted = [];
    this.tasksFailed = [];
    this.tasksFailedFull = [];
    this.steady = false;
    this.end = false;
    this.notFoundCount = 0;

    this.history = [];

    this.service = options.service;
    this.service.on('updated', this._serviceUpdated.bind(this));
    this.service.on('event', this._serviceEventListener.bind(this));
    this.service.on('error', (err) => {
      this.emit('error', err);
    });

    this.on('updated', () => {
      this.evaluate(evaluators, _.noop);
    });
  }

  _serviceUpdated() {
    this.raw = _.find(this.service.raw.deployments, (d) => {
      return d.taskDefinition === this.options.taskDefinitionArn;
    });

    if (!this.raw) {
      if (this.notFoundCount < 3) {
        this.notFoundCount++;
        return;
      }

      this.setState('NotFound');
    }

    this.stoppedTasks((err, tasks) => {
      if (err) return this.emit('error', err);
      var taskArns = _.map(tasks, (task) => task.taskArn);
      logger.log({ level: 'debug', type: 'deployment', message: `Tasks Stopped: ${taskArns.join(', ')}` });

      this.tasksFailed = _.map(tasks, (task) => task.taskArn);
      this.tasksFailedFull = tasks;
      this.emit('updated');
    });
  }

  _serviceEventListener(event) {
    if (this.isFailure()) return;

    var filterDeploymentTasks = (tasks) => {
      return _.filter(event.tasks, (task) => this.doesTaskBelong(task));
    }

    if (event instanceof events.TasksStartedEvent) {
      let deploymentTasks = filterDeploymentTasks(event.tasks);
      let deploymentTasksArns = _.map(deploymentTasks, (task) => task.taskArn);
      this.tasksStarted.push.apply(this.tasksStarted, deploymentTasksArns);
      logger.log({ level: 'debug', type: 'deployment', message: `Tasks Started: ${deploymentTasksArns.join(', ')}` });
    }

    if (event instanceof events.SteadyEvent) {
      this.steady = true;
    }
  }

  /**
   * doesTaskBelong
   *
   * Does the provided task belong to this deployment
   *
   * @param {object} task A task object
   * @return {boolean}
   */
  doesTaskBelong(task) {
    return (
      task.taskDefinitionArn === this.options.taskDefinitionArn &&
      // Make sure we don't associate tasks of the same definition version
      // with this deployment if they were created before this deployment was created
      task.createdAt > this.raw.createdAt
    );
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
    logger.log({ level: 'info', type: 'deployment', message: 'Starting deployment evaluation' });

    // Skip evaluation if service is not initiated or has failed
    if (!this.service.initiated || this.isFailure()) return cb();

    async.eachSeries(Deployment.evaluationOrder, (state, done) => {
      var evaluator = evaluators[state];
      if (!evaluator || this.end || this.hasState(state)) return done();

      evaluator(this, (err, result) => {
        if (err || !result) return done(err);
        this.setState(state);
        done();
      });
    }, cb);
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
   * stoppedTasks
   *
   * A list of tasks that started as part of this deployment
   * but have now stopped.
   *
   * @param {function} cb Callback
   */
  stoppedTasks(cb) {
    if (this.tasksStarted.length === 0) return cb(null, []);

    // We need to fetch a fresh list of tasks as stopped tasks may
    // not be associated with the service. For example tasks started
    // in a service but failed before they joined the loadbalancer will
    // not emit a stopped event or be associated with the service. So
    // we must figure that out ourselves.
    taskLoader(this.service, this.tasksStarted, (err, tasks) => {
      if (err) return cb(err);
      cb(null, _.filter(tasks, (task) => task.lastStatus === 'STOPPED'));
    });
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
    logger.log({ level: 'info', type: 'deployment', message: `Setting deployment state to "${state}"` });

    this.state = state;
    this.history.push({ state: this.state, transitionedAt: Date.now() });
    this.emit('state', state);
    this.emit(`state:${state}`);

    if (this.isSteady() || this.isFailure()) {
      logger.log({ level: 'info', type: 'deployment', message: `Deployment has ended` });

      this.end = true;
      this.destroy();
      this.emit('end');
    }
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
   * isSteady
   *
   * Has this deployment entered into a the steady state
   *
   * @return {boolean}
   */
  isSteady() {
    return this.hasState('Steady');
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
  'Usurped',
  'Created',
  'TasksStarted',
  'TasksFailed',
  'Live',
  'Draining',
  'Steady'
]

Deployment.failureStates = ['NotFound', 'Usurped', 'TasksFailed'];

module.exports = Deployment;
