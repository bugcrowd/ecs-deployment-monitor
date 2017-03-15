'use strict'

const Readable = require('stream').Readable;
const AWS = require('aws-sdk');
const _ = require('lodash');

class StatusStream extends Readable {
  constructor(options) {
    options.objectMode = true;
    super(options);

    this.options = _.defaults(options, {
      durationBetweenPolls: 1000
    });

    this.eventBuffer = [];
    this.pending = false;
    this.streamEnded = false;
    this.ecs = new AWS.ECS();
  }

  requestDeploymentStatus() {
    this.pending = true;

    var next = (err, data) => {
      setTimeout(this._read.bind(this), this.options.durationBetweenPolls);
    };

    var params = {
      services: [this.options.service],
      cluster: this.options.cluster
    };

    this.ecs.describeServices(params, (err, data) => {
      this.pending = false;
      if (err) return process.nextTick(() => this.emit('error', err));

      var status = determineStatus(data);
      this.eventBuffer.push(status);
      if (status.end) this.streamEnded = true;
    });
  }

  determineStatus(data) {
    var service = data['services'][0];
    var deployments = service['deployments'];
    var deployment = _.find(deployments, (deployment) => deployment.taskDefinition === options.taskDefinition);

    if (!deployment) {
      return { status: "DEPLOYMENT_NOT_FOUND" };
    }

    var inProgress = deployment.desiredCount < deployment.runningCount;
    var deployed = deployment.desiredCount === deployment.runningCount;

    if (deployment.status !== "PRIMARY") {
      return { status: "NEWER_DEPLOY_IN_PROGRESS", end: true};
    }

    if (inProgress && deployment.pendingCount === 0) {
      return { status: "IN_PROGRESS", started: false };
    }

    if (inProgress && deployment.pendingCount > 0) {
      return { status: "IN_PROGRESS", started: true };
    }

    if (deployed && deployments.length > 1) {
      return { status: "DEPLOYED", deprovisionedOldDeployment: false };
    }
    if (deployed && deployments.length === 0) {
      return { status: "DEPLOYED", deprovisionedOldDeployment: true, end: true };
    }
  }

  _read() {
    var active = true;
    while (active && this.eventBuffer.length) active = this.push(this.eventBuffer.shift());

    // Downstream buffers are full. Lets give them 100ms to recover
    if (!active) return setTimeout(this._read.bind(this), 100);

    if (this.streamEnded) return this.push(null);
    if (active && !this.pending) this.requestDeploymentStatus();
  }
}

module.exports = StatusStream
