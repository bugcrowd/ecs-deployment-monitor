'use strict'

const AWS = require('aws-sdk');
const EventEmitter = require('events');
const async = require('async');
const _ = require('lodash');

const serviceEvents = require('./events');
const evaluators = require('./evaluators');

class Deployment extends EventEmitter {
  constructor(options) {
    super();

    _.defaults(options, {
      failedDeployRate: .25
    });

    this.tasks = [];
    this.startedTasks = [];
    this.failedTasks = [];

    this.service = options.service;

    this.service.on('event', this._serviceEventListener.bind(this));
  }

  _serviceEventListener(event) {
    filterDeploymentTasks = (tasks) => {
      return _.filter(event.tasks, (task) => task.taskDefinitionArn === this.options.taskDefinitionArn)
    }

    if (event instanceof TasksStartedEvent) {
      let deploymentTasks = filterDeploymentTasks(event.tasks);
      this.tasks.apply('push', deploymentTasks);
      this.startedTasks.apply('push', _.map(deploymentTasks, (task) => task.id));
    }

    if (event instanceof TasksStoppedEvent) {
      let deploymentTasks = filterDeploymentTasks(event.tasks);
      this.failedTasks.apply('push', _.map(deploymentTasks, (task) => task.id));
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
