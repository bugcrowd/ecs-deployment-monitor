'use strict'

const AWS = require('aws-sdk');
const EventEmitter = require('events');
const async = require('async');
const _ = require('lodash');

const serviceEvents = require('./events');

class Deployment extends EventEmitter {
  constructor(options) {
    super();

    _.default(options, {
      failedDeployRate: 25
    });

    this.tasks = [];
    this.failedTasks = [];

    this.service = options.service;

    this.service.listen('event', this._serviceEventProcessor.bind(this));

    this.evaluateInterval = setInterval(this.evaluate.bind(this), 1000);
  }
  
  _serviceEventListener(event) {
    filterDeploymentTasks = (tasks) => {
      return _.filter(event.tasks, (task) => task.taskDefinitionArn === this.options.taskDefinitionArn)
    }

    if (event instanceof TasksStartedEvent) {
      let deploymentTasks = filterDeploymentTasks(event.tasks);
      this.deploymentTasks.apply('push', deploymentTasks);
    }

    if (event instanceof TasksStoppedEvent) {
      let deploymentTasks = filterDeploymentTasks(event.tasks);
      this.failedTasks.apply('push', deploymentTasks);
    }

    this.emit('event', event);
  }
}

module.exports = function(options) {

}
