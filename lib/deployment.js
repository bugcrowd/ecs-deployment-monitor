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
      failedDeployRate: .25
    });

    this.options = options;

    this.tasks = [];
    this.tasksStarted = [];
    this.tasksFailed = [];

    this.service = options.service;

    this.service.on('event', this._serviceEventListener.bind(this));
  }

  _serviceEventListener(event) {
    var filterDeploymentTasks = (tasks) => {
      return _.filter(event.tasks, (task) => task.taskDefinitionArn === this.options.taskDefinitionArn);
    }

    if (event instanceof events.TasksStartedEvent) {
      let deploymentTasks = filterDeploymentTasks(event.tasks);
      this.tasks.push.apply(this.tasks, deploymentTasks);
      this.tasksStarted.push.apply(this.tasksStarted, _.map(deploymentTasks, (task) => task.id));
    }

    if (event instanceof events.TasksStoppedEvent) {
      let deploymentTasks = filterDeploymentTasks(event.tasks);
      this.tasksFailed.push.apply(this.tasksFailed, _.map(deploymentTasks, (task) => task.id));
    }

    this.evaluate();
  }

  evaluate() {
    let order = [
      evaluators.NotFound,
      evaluators.Usurped,
      evaluators.Failed,
      evaluators.Created,
      evaluators.StartingTasks,
      evaluators.Live,
      evaluators.RollingOut,
      evaluators.Stable
    ];


  }
}

module.exports = Deployment;
