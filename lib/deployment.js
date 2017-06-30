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

    this.history = [];

    this.service = options.service;

    this.service.on('event', this._serviceEventListener.bind(this));

    this.evaluateInterval = setInterval(this.evaluate.bind(this), this.options.durationBetweenPolls);
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
  }

  evaluate(cb) {
    let order = [
      'NotFound',
      'Usurped',
      'Failed',
      'Created',
      'StartingTasks',
      'Live',
      'RollingOut',
      'Stable'
    ];

    async.eachSeries(order, (state, done) => {
      evaluators[state](this, (err, result) => {
        if (err || !result) return done(err);
        this.setState(state);
        done();
      });
    }, cb);
  }

  setState(state) {
    this.state = state;
    this.history.push({ state: this.state, transitionedAt: Date.now()});
    this.emit('state', state);
  }

  destroy() {
    clearTimeout(this.evaluateInterval);
  }
}

module.exports = Deployment;
